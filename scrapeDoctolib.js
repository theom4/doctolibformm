const { chromium } = require('playwright');
const path = require('path');

// Create screenshots directory
const screenshotDir = path.join(__dirname, 'screenshots');
const fs = require('fs');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function scrapeDoctolib(email, password, number) {
  let context; // BrowserContext for persistent session
  let page;
  const acceptCookies = true; // Toggle this to true/false to enable/disable cookie acceptance

  try {
    const userDataDir = path.join(__dirname, 'user_data');
    console.log(`Launching browser with persistent user data directory: ${userDataDir}`);

    // Launch the browser with a persistent context to maintain login sessions
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      slowMo: 100,
      viewport: { width: 1400, height: 900 } // Ensure viewport is large enough
    });

    // Use the existing page or create a new one
    const pages = context.pages();
    if (pages.length > 0) {
      page = pages[0];
      console.log('Using existing page from persistent context.');
    } else {
      page = await context.newPage();
      console.log('Creating new page in persistent context.');
    }

    // --- SCREENSHOT LA PRIMA PAGINĂ CÂND SE DESCHIDE BROWSERUL ---
    try {
      const initialBrowserPath = path.join(screenshotDir, `initial_browser_start_${Date.now()}.png`);
      await page.screenshot({ path: initialBrowserPath, fullPage: true });
      console.log(`📸 Screenshot la deschiderea browserului salvat ca ${initialBrowserPath}`);
      console.log(`Current URL at browser start: ${page.url()}`);
    } catch (screenshotError) {
      console.warn('Could not take initial browser screenshot:', screenshotError);
    }

    // --- 1. LOGIN OR NAVIGATE ---
    // Check if we are already on the calendar page. If not, navigate and log in.
    if (!page.url().includes('pro.doctolib.fr/calendar')) {
      console.log('Not on the calendar page. Starting login process...');
      await page.goto('https://pro.doctolib.fr/signin', { waitUntil: 'domcontentloaded', timeout: 60000 });

      // --- SCREENSHOT LA PRIMA PAGINĂ DE LOGIN ---
      try {
        const initialScreenshotPath = path.join(screenshotDir, `initial_login_page_${Date.now()}.png`);
        await page.screenshot({ path: initialScreenshotPath, fullPage: true });
        console.log(`📸 Screenshot pagina initiala de login salvat ca ${initialScreenshotPath}`);
      } catch (screenshotError) {
        console.warn('Could not take initial login page screenshot:', screenshotError);
      }

      // Double-check if the navigation immediately redirected to the calendar (already logged in)
      if (page.url().includes('pro.doctolib.fr/calendar')) {
        console.log('Detected that the browser is already logged in. Skipping login steps.');
      } else {
        // --- Handle Cookie Consent ---
        if (acceptCookies) {
          console.log('Checking for cookie consent dialog...');
          const cookieAcceptButtonSelector = 'button#didomi-notice-agree-button';
          try {
            await page.waitForSelector(cookieAcceptButtonSelector, { state: 'visible', timeout: 10000 });
            console.log('Cookie consent dialog found. Clicking "Accepter".');
            await page.click(cookieAcceptButtonSelector);
            await page.waitForTimeout(2000);
          } catch (error) {
            console.log('Cookie consent dialog not found. Proceeding.');
          }
        } else {
          console.log('Cookie acceptance disabled. Skipping cookie consent dialog.');
        }

        // --- Perform Login with Improved Detection ---
        const DOCTOLIB_USERNAME = email;
        const DOCTOLIB_PASSWORD = password;
        
        console.log('Analyzing login form structure...');
        
        // Take screenshot before looking for password field
        try {
          const beforePasswordPath = path.join(screenshotDir, `before_password_search_${Date.now()}.png`);
          await page.screenshot({ path: beforePasswordPath, fullPage: true });
          console.log(`📸 Screenshot before password search saved as ${beforePasswordPath}`);
        } catch (screenshotError) {
          console.warn('Could not take screenshot before password search:', screenshotError);
        }
        
        // Wait for the password field to be visible (this should always be present)
        const passwordInput = page.locator('input#password');
        try {
          await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
          console.log('Password field found.');
        } catch (passwordError) {
          console.error('Password field not found. Taking screenshot for debugging...');
          try {
            const passwordErrorPath = path.join(screenshotDir, `password_field_error_${Date.now()}.png`);
            await page.screenshot({ path: passwordErrorPath, fullPage: true });
            console.log(`📸 Screenshot saved as ${passwordErrorPath}`);
          } catch (screenshotError) {
            console.warn('Could not take screenshot:', screenshotError);
          }
          throw passwordError;
        }
        
        // Check for username field with a reasonable timeout
        const usernameInput = page.locator('input#username');
        let usernameFieldExists = false;
        
        try {
          await usernameInput.waitFor({ state: 'visible', timeout: 5000 });
          usernameFieldExists = true;
          console.log('Username field found - Full login required.');
        } catch (error) {
          console.log('Username field not found - Password-only login detected.');
          // Take screenshot when username field is not found
          try {
            const noUsernameFieldPath = path.join(screenshotDir, `no_username_field_${Date.now()}.png`);
            await page.screenshot({ path: noUsernameFieldPath, fullPage: true });
            console.log(`📸 Screenshot saved as ${noUsernameFieldPath}`);
          } catch (screenshotError) {
            console.warn('Could not take screenshot:', screenshotError);
          }
        }
        
        // Alternative way to detect login type by checking DOM elements
        if (!usernameFieldExists) {
          // Double-check by looking for any input with name="username" or similar
          const alternativeUsernameSelectors = [
            'input[name="username"]',
            'input[name="email"]',
            'input[type="email"]',
            'input[placeholder*="mail" i]',
            'input[placeholder*="utilisateur" i]'
          ];
          
          for (const selector of alternativeUsernameSelectors) {
            try {
              const altUsernameField = page.locator(selector);
              await altUsernameField.waitFor({ state: 'visible', timeout: 2000 });
              console.log(`Alternative username field found with selector: ${selector}`);
              usernameFieldExists = true;
              break;
            } catch (error) {
              // Continue to next selector
            }
          }
        }
        
        // Perform login based on detected form type
        if (usernameFieldExists) {
          // SCENARIO: Full login with username and password
          console.log('=== FULL LOGIN MODE ===');
          
          // --- ADAUGĂ ACEST BLOC PENTRU SCREENSHOT LA EROARE DE LOGIN ---
          try {
            await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
            await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
            await page.waitForSelector('button[type="submit"].dl-button-primary', { state: 'visible', timeout: 15000 });
          } catch (error) {
            console.error(`ERROR: Login element not found: ${error.message}`);
            const screenshotPath = path.join(screenshotDir, `login_timeout_error_${Date.now()}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 Screenshot salvat ca ${screenshotPath}`);
            throw error; // Re-aruncă eroarea pentru a menține fluxul original
          }
          // ---------------------------------------------------
          
          console.log('Waiting for all login form elements...');
          
          // Look for submit button with multiple possible selectors
          const submitButtonSelectors = [
            'button[type="submit"].dl-button-primary',
            'button[type="submit"]',
            'button:has-text("Se connecter")',
            'button:has-text("Connexion")',
            '.dl-button-primary'
          ];
          
          let submitButton = null;
          for (const selector of submitButtonSelectors) {
            try {
              submitButton = page.locator(selector).first();
              await submitButton.waitFor({ state: 'visible', timeout: 3000 });
              console.log(`Submit button found with selector: ${selector}`);
              break;
            } catch (error) {
              continue;
            }
          }
          
          if (!submitButton) {
            throw new Error('Could not find submit button for full login form');
          }
  
          console.log('Entering login credentials...');
          await usernameInput.fill(DOCTOLIB_USERNAME);
          await passwordInput.fill(DOCTOLIB_PASSWORD);
  
          console.log('Clicking login button...');
          await submitButton.click();
          
        } else {
          // SCENARIO: Password-only login
          console.log('=== PASSWORD-ONLY LOGIN MODE ===');
          
          console.log('Entering password...');
          await passwordInput.fill(DOCTOLIB_PASSWORD);

          // Look for login button with multiple possible selectors
          const loginButtonSelectors = [
            'button:has-text("Se connecter")',
            'button:has-text("Connexion")',
            'button[type="submit"]',
            '.dl-button-primary'
          ];
          
          let loginButton = null;
          for (const selector of loginButtonSelectors) {
            try {
              loginButton = page.locator(selector).first();
              await loginButton.waitFor({ state: 'visible', timeout: 3000 });
              console.log(`Login button found with selector: ${selector}`);
              break;
            } catch (error) {
              continue;
            }
          }
          
          if (!loginButton) {
            throw new Error('Could not find login button for password-only form');
          }

          console.log('Clicking "Se connecter" button...');
          await loginButton.click();
        }

        // --- Wait for navigation to calendar (handles post-login/2FA redirect) ---
        console.log('Waiting for navigation to agenda page...');
        try {
            await page.waitForURL(/pro.doctolib.fr\/calendar/i, { waitUntil: 'networkidle', timeout: 360000 });
            console.log(`Successfully navigated to agenda page. Current URL: ${page.url()}`);
        } catch (error) {
            console.error('CRITICAL ERROR: Failed to navigate to the agenda page after login attempt.', error);
            const navigationErrorPath = path.join(screenshotDir, `login_or_agenda_navigation_error_${Date.now()}.png`);
            await page.screenshot({ path: navigationErrorPath, fullPage: true });
            console.log(`📸 Screenshot navigation error saved as ${navigationErrorPath}`);
            throw new Error('Failed to complete login or navigate to agenda. Cannot proceed.');
        }
        
        // --- Handle Identity Verification Modal (CPS) ---
        console.log('Checking for identity verification modal...');
        try {
          // Look for the modal with the identity verification message
          const identityModalSelectors = [
            '.dl-modal-content:has-text("Confirmez votre identité")',
            '.dl-modal-content:has-text("vérification")',
            'div[class*="modal"]:has-text("CPS")',
            '.dl-modal-content'
          ];
          
          let modalFound = false;
          
          for (const modalSelector of identityModalSelectors) {
            try {
              const modal = page.locator(modalSelector).first();
              await modal.waitFor({ state: 'visible', timeout: 5000 });
              console.log(`Identity verification modal found with selector: ${modalSelector}`);
              modalFound = true;
              
              // Look for the close button (X) in the modal
              const closeButtonSelectors = [
                '.dl-modal-close-icon button',
                'button[aria-label="Fermer"]',
                '.dl-modal-content button:has-text("×")',
                '.dl-modal-content .dl-icon:has([data-icon-name*="xmark"])',
                '.dl-modal-close-icon',
                'button:has(.dl-icon[data-icon-name*="xmark"])'
              ];
              
              let modalClosed = false;
              
              for (const closeSelector of closeButtonSelectors) {
                try {
                  const closeButton = page.locator(closeSelector).first();
                  await closeButton.waitFor({ state: 'visible', timeout: 3000 });
                  console.log(`Close button found with selector: ${closeSelector}`);
                  await closeButton.click();
                  console.log('✅ Identity verification modal closed successfully.');
                  modalClosed = true;
                  break;
                } catch (error) {
                  continue;
                }
              }
              
              if (!modalClosed) {
                // Fallback: Try pressing Escape key
                console.log('Close button not found, trying Escape key...');
                await page.keyboard.press('Escape');
                console.log('✅ Attempted to close modal with Escape key.');
              }
              
              // Wait a moment for the modal to disappear
              await page.waitForTimeout(2000);
              break;
              
            } catch (error) {
              continue;
            }
          }
          
          if (!modalFound) {
            console.log('No identity verification modal found. Proceeding to scrape.');
          }
          
        } catch (error) {
          console.warn('Error handling identity verification modal:', error);
          console.log('Attempting to continue with scraping...');
        }
      }
    } else {
        console.log('Already on the calendar page. Proceeding to scrape.');
        await page.reload({ waitUntil: 'networkidle' });
        console.log('Page reloaded to ensure fresh state.');
        
        // --- Handle Identity Verification Modal (CPS) even when already on calendar ---
        console.log('Checking for identity verification modal after reload...');
        try {
          // Look for the modal with the identity verification message
          const identityModalSelectors = [
            '.dl-modal-content:has-text("Confirmez votre identité")',
            '.dl-modal-content:has-text("vérification")',
            'div[class*="modal"]:has-text("CPS")',
            '.dl-modal-content'
          ];
          
          let modalFound = false;
          
          for (const modalSelector of identityModalSelectors) {
            try {
              const modal = page.locator(modalSelector).first();
              await modal.waitFor({ state: 'visible', timeout: 5000 });
              console.log(`Identity verification modal found with selector: ${modalSelector}`);
              modalFound = true;
              
              // Look for the close button (X) in the modal
              const closeButtonSelectors = [
                '.dl-modal-close-icon button',
                'button[aria-label="Fermer"]',
                '.dl-modal-content button:has-text("×")',
                '.dl-modal-content .dl-icon:has([data-icon-name*="xmark"])',
                '.dl-modal-close-icon',
                'button:has(.dl-icon[data-icon-name*="xmark"])'
              ];
              
              let modalClosed = false;
              
              for (const closeSelector of closeButtonSelectors) {
                try {
                  const closeButton = page.locator(closeSelector).first();
                  await closeButton.waitFor({ state: 'visible', timeout: 3000 });
                  console.log(`Close button found with selector: ${closeSelector}`);
                  await closeButton.click();
                  console.log('✅ Identity verification modal closed successfully.');
                  modalClosed = true;
                  break;
                } catch (error) {
                  continue;
                }
              }
              
              if (!modalClosed) {
                // Fallback: Try pressing Escape key
                console.log('Close button not found, trying Escape key...');
                await page.keyboard.press('Escape');
                console.log('✅ Attempted to close modal with Escape key.');
              }
              
              // Wait a moment for the modal to disappear
              await page.waitForTimeout(2000);
              break;
              
            } catch (error) {
              continue;
            }
          }
          
          if (!modalFound) {
            console.log('No identity verification modal found. Proceeding to scrape.');
          }
          
        } catch (error) {
          console.warn('Error handling identity verification modal:', error);
          console.log('Attempting to continue with scraping...');
        }
    }

    // --- 2. SCRAPE APPOINTMENTS ---
    const appointmentsData = [];
    // This selector targets the clickable appointment blocks on the calendar
    const appointmentSelector = 'div.dc-event-inner';

    console.log('Waiting for appointment elements on the calendar...');
    try {
      await page.waitForSelector(appointmentSelector, { state: 'visible', timeout: 45000 });
      console.log('Appointment elements are visible on the calendar.');
    } catch (error) {
      console.warn('No appointment elements found on the main calendar page. The day might be empty.');
      console.log('✅ Script finished (no appointments found).');
      await context.close();
      return;
    }

    const appointmentLocators = page.locator(appointmentSelector);
    const appointmentCount = await appointmentLocators.count();
    console.log(`Found ${appointmentCount} appointments to process.`);

    // --- Loop through each appointment ---
    for (let i = 0; i < appointmentCount; i++) {
      const currentAppointment = appointmentLocators.nth(i);
      let patientName = 'Unknown Patient';
      let appointmentTime = 'Unknown Time';
      let appointmentDate = 'Unknown Date';
      let phoneNumber = 'N/A';

      try {
        // Extract patient name and time from the appointment block on the calendar
        const lastName = await currentAppointment.locator('[data-appointment-last-name]').getAttribute('data-appointment-last-name');
        const firstName = await currentAppointment.locator('[data-appointment-first-name]').getAttribute('data-appointment-first-name');
        appointmentTime = await currentAppointment.locator('[data-event-time]').getAttribute('data-event-time');
        patientName = `${lastName || ''} ${firstName || ''}`.trim();

        console.log(`\n--- Processing appointment ${i + 1}/${appointmentCount}: "${patientName}" at ${appointmentTime} ---`);

        // Click the appointment to open the details sidebar
        console.log(`Clicking on appointment for "${patientName}"...`);
        await currentAppointment.click();

        // Wait for the sidebar to become visible
        const sidebarSelector = 'div.dl-left-navigation-bar';
        await page.waitForSelector(sidebarSelector, { state: 'visible', timeout: 20000 });
        console.log('Sidebar is visible.');

        // --- Extract the full date from the sidebar ---
        const dateInputSelector = 'input#appointment_start_date';
        try {
          const dateInput = page.locator(dateInputSelector);
          await dateInput.waitFor({ state: 'visible', timeout: 10000 });
          appointmentDate = await dateInput.getAttribute('value');
          console.log(`✅ Full date found: ${appointmentDate}`);
        } catch (error) {
          console.warn(`⚠️ Could not find the full date input for "${patientName}".`);
        }

        // --- Extract the phone number from the sidebar ---
        const phoneNumberSelector = 'a#phone_number';
        try {
          const phoneLink = page.locator(phoneNumberSelector);
          await phoneLink.waitFor({ state: 'visible', timeout: 10000 });
          const href = await phoneLink.getAttribute('href');
          if (href) {
            // Cleans up "tel:" prefix and any spaces from the href attribute
            phoneNumber = href.replace('tel:', '').replace(/\s/g, '');
          }
          console.log(`✅ Phone number found: ${phoneNumber}`);
        } catch (error) {
          console.warn(`⚠️ Could not find phone number for "${patientName}". It may not be listed.`);
        }

        // Store the extracted data
        appointmentsData.push({
          patient: patientName,
          dateTime: `${appointmentDate} ${appointmentTime}`.trim(),
          phoneNumber: phoneNumber,
        });

        // Close the sidebar by clicking the "Agenda" button to return to the calendar
        console.log('Returning to the main agenda view...');
        // This selector targets the "Agenda" button in the sidebar based on its text content and structure
        const agendaButtonSelector = 'div.dl-permanent-entry-label:has-text("Agenda")';
        await page.locator(agendaButtonSelector).click();

        // Wait for the sidebar to be hidden to ensure the page is ready for the next action
        await page.waitForSelector(sidebarSelector, { state: 'hidden', timeout: 10000 });
        console.log('Sidebar closed successfully.');

      } catch (error) {
        console.error(`Error processing appointment ${i + 1} ("${patientName}"):`, error);
        // Store error information for this appointment
        appointmentsData.push({
          patient: patientName,
          dateTime: 'Error processing',
          phoneNumber: 'Error processing',
        });

        // Attempt to recover by pressing the Escape key to close any open modal/sidebar
        console.log('Attempting to recover by pressing "Escape"...');
        await page.keyboard.press('Escape');
      }

      // Add a small random delay to mimic human behavior
      await page.waitForTimeout(1000 + Math.random() * 500);
    }

    // --- 3. FINAL RESULTS & WEBHOOK ---
    console.log('\n--- Final Results ---');
    
    // Filter out appointments where the phone number was not found or had an error
    const successfulScrapes = appointmentsData.filter(
      data => data.phoneNumber && data.phoneNumber !== 'N/A' && data.phoneNumber !== 'Error processing'
    );

    console.log(`✨ Total appointments processed: ${appointmentsData.length}`);
    console.log(`✅ Found ${successfulScrapes.length} appointments with valid phone numbers.`);

    if (successfulScrapes.length > 0) {
      console.log('Displaying successfully scraped appointments:');
      console.table(successfulScrapes);

      // --- Send Webhook ---
      console.log('\n--- Sending Webhook ---');
      const webhookUrl = number;
      try {
        console.log(`Sending ${successfulScrapes.length} appointments to webhook...`);
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(successfulScrapes),
        });

        if (response.ok) {
          console.log('✅ Webhook sent successfully!');
        } else {
          console.error(`❌ Failed to send webhook. Status: ${response.status} ${response.statusText}`);
          const responseBody = await response.text();
          console.error('Response body:', responseBody);
        }
      } catch (error) {
        console.error('❌ An error occurred while sending the webhook:', error);
      }

    } else {
      console.log('No appointments with valid phone numbers were found in this run.');
    }

  } catch (error) {
    console.error('An unhandled error occurred during a critical part of the script:', error);
    if (page) {
        const debugErrorPath = path.join(screenshotDir, `debug_error_${Date.now()}.png`);
        await page.screenshot({ path: debugErrorPath, fullPage: true });
        console.log(`📸 Screenshot salvat ca ${debugErrorPath}`);
    }
  } finally {
    if (context) {
      await context.close();
      console.log('\n✅ Scraping complete and browser closed.');
    }
  }
}

// Export the function for use by the webhook server
module.exports = { scrapeDoctolib };