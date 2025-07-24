const { chromium } = require('playwright');
const path = require('path');

// Create screenshots directory
const screenshotDir = path.join(__dirname, 'screenshots');
const fs = require('fs');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function scrapeDoctolib(email, password, number) {
  let context;
  let page;
  const acceptCookies = true;

  try {
    const userDataDir = path.join(__dirname, 'user_data');
    console.log(`Launching browser with persistent user data directory: ${userDataDir}`);

    // Launch browser with more realistic settings
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      slowMo: 200, // Increased delay
      viewport: { width: 1400, height: 900 },
      // Add user agent to avoid detection
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // Additional options to avoid detection
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const pages = context.pages();
    if (pages.length > 0) {
      page = pages[0];
      console.log('Using existing page from persistent context.');
    } else {
      page = await context.newPage();
      console.log('Creating new page in persistent context.');
    }

    // Clear any existing state
    try {
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch (e) {
      console.log('Could not clear storage, continuing...');
    }

    // Initial screenshot
    try {
      const initialBrowserPath = path.join(screenshotDir, `initial_browser_start_${Date.now()}.png`);
      await page.screenshot({ path: initialBrowserPath, fullPage: true });
      console.log(`📸 Initial screenshot saved as ${initialBrowserPath}`);
      console.log(`Current URL at browser start: ${page.url()}`);
    } catch (screenshotError) {
      console.warn('Could not take initial browser screenshot:', screenshotError);
    }

    // Check if already logged in
    if (!page.url().includes('pro.doctolib.fr/calendar')) {
      console.log('Not on the calendar page. Starting login process...');
      
      // Navigate to login page with longer timeout
      console.log('Navigating to login page...');
      await page.goto('https://pro.doctolib.fr/signin', { 
        waitUntil: 'networkidle',
        timeout: 90000 
      });

      // Wait additional time for dynamic content
      await page.waitForTimeout(3000);

      // Take screenshot after navigation
      try {
        const afterNavigationPath = path.join(screenshotDir, `after_navigation_${Date.now()}.png`);
        await page.screenshot({ path: afterNavigationPath, fullPage: true });
        console.log(`📸 Screenshot after navigation saved as ${afterNavigationPath}`);
        console.log(`Current URL after navigation: ${page.url()}`);
      } catch (screenshotError) {
        console.warn('Could not take screenshot after navigation:', screenshotError);
      }

      // Check if redirected to calendar (already logged in)
      if (page.url().includes('pro.doctolib.fr/calendar')) {
        console.log('Already logged in, redirected to calendar. Skipping login steps.');
      } else {
        // Handle cookie consent with more robust approach
        if (acceptCookies) {
          console.log('Checking for cookie consent dialog...');
          const cookieSelectors = [
            'button#didomi-notice-agree-button',
            'button[id*="agree"]',
            'button[class*="agree"]',
            'button:has-text("Accepter")',
            'button:has-text("Accept")',
            '[data-testid="accept-cookies"]'
          ];
          
          for (const selector of cookieSelectors) {
            try {
              const cookieButton = page.locator(selector).first();
              await cookieButton.waitFor({ state: 'visible', timeout: 5000 });
              console.log(`Cookie consent found with selector: ${selector}`);
              await cookieButton.click();
              await page.waitForTimeout(2000);
              break;
            } catch (error) {
              continue;
            }
          }
        }

        // Enhanced login form detection
        console.log('Analyzing login form structure with enhanced detection...');
        
        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle');
        
        // Take screenshot before looking for form elements
        try {
          const beforeFormSearchPath = path.join(screenshotDir, `before_form_search_${Date.now()}.png`);
          await page.screenshot({ path: beforeFormSearchPath, fullPage: true });
          console.log(`📸 Screenshot before form search saved as ${beforeFormSearchPath}`);
        } catch (screenshotError) {
          console.warn('Could not take screenshot before form search:', screenshotError);
        }

        // Enhanced password field detection with multiple selectors
        const passwordSelectors = [
          'input#password',
          'input[name="password"]',
          'input[type="password"]',
          'input[placeholder*="password" i]',
          'input[placeholder*="mot de passe" i]',
          'input[autocomplete="current-password"]',
          'input[autocomplete="password"]'
        ];

        let passwordInput = null;
        let foundPasswordSelector = null;

        console.log('Searching for password field with multiple selectors...');
        for (const selector of passwordSelectors) {
          try {
            console.log(`Trying password selector: ${selector}`);
            passwordInput = page.locator(selector).first();
            await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
            foundPasswordSelector = selector;
            console.log(`✅ Password field found with selector: ${selector}`);
            break;
          } catch (error) {
            console.log(`❌ Password selector ${selector} not found, trying next...`);
            continue;
          }
        }

        if (!passwordInput || !foundPasswordSelector) {
          console.error('❌ NO PASSWORD FIELD FOUND with any selector!');
          
          // Debug: Log all input elements on the page
          try {
            const allInputs = await page.locator('input').all();
            console.log(`Found ${allInputs.length} input elements on the page:`);
            for (let i = 0; i < allInputs.length; i++) {
              const input = allInputs[i];
              const type = await input.getAttribute('type') || 'text';
              const id = await input.getAttribute('id') || 'no-id';
              const name = await input.getAttribute('name') || 'no-name';
              const placeholder = await input.getAttribute('placeholder') || 'no-placeholder';
              const className = await input.getAttribute('class') || 'no-class';
              console.log(`  Input ${i}: type="${type}", id="${id}", name="${name}", placeholder="${placeholder}", class="${className}"`);
            }
          } catch (debugError) {
            console.error('Could not debug input elements:', debugError);
          }

          // Take error screenshot
          const passwordErrorPath = path.join(screenshotDir, `password_field_not_found_${Date.now()}.png`);
          await page.screenshot({ path: passwordErrorPath, fullPage: true });
          console.log(`📸 Password field error screenshot saved as ${passwordErrorPath}`);
          
          throw new Error('Password field not found with any selector');
        }

        // Enhanced username field detection
        const usernameSelectors = [
          'input#username',
          'input[name="username"]',
          'input[name="email"]',
          'input[type="email"]',
          'input[placeholder*="mail" i]',
          'input[placeholder*="utilisateur" i]',
          'input[placeholder*="username" i]',
          'input[autocomplete="username"]',
          'input[autocomplete="email"]'
        ];

        let usernameInput = null;
        let usernameFieldExists = false;
        let foundUsernameSelector = null;

        console.log('Searching for username/email field...');
        for (const selector of usernameSelectors) {
          try {
            console.log(`Trying username selector: ${selector}`);
            usernameInput = page.locator(selector).first();
            await usernameInput.waitFor({ state: 'visible', timeout: 5000 });
            usernameFieldExists = true;
            foundUsernameSelector = selector;
            console.log(`✅ Username field found with selector: ${selector}`);
            break;
          } catch (error) {
            console.log(`❌ Username selector ${selector} not found, trying next...`);
            continue;
          }
        }

        if (!usernameFieldExists) {
          console.log('No username field found - Password-only login detected.');
          
          // Take screenshot for password-only mode
          try {
            const passwordOnlyPath = path.join(screenshotDir, `password_only_mode_${Date.now()}.png`);
            await page.screenshot({ path: passwordOnlyPath, fullPage: true });
            console.log(`📸 Password-only mode screenshot saved as ${passwordOnlyPath}`);
          } catch (screenshotError) {
            console.warn('Could not take password-only screenshot:', screenshotError);
          }
        }

        // Perform login based on detected form type
        if (usernameFieldExists && usernameInput) {
          console.log('=== FULL LOGIN MODE ===');
          console.log(`Using username selector: ${foundUsernameSelector}`);
          console.log(`Using password selector: ${foundPasswordSelector}`);

          // Find submit button
          const submitButtonSelectors = [
            'button[type="submit"]',
            'button:has-text("Se connecter")',
            'button:has-text("Connexion")',
            'button:has-text("Se conn")',
            'input[type="submit"]',
            '.dl-button-primary',
            'button.btn-primary',
            'form button'
          ];

          let submitButton = null;
          for (const selector of submitButtonSelectors) {
            try {
              submitButton = page.locator(selector).first();
              await submitButton.waitFor({ state: 'visible', timeout: 5000 });
              console.log(`✅ Submit button found with selector: ${selector}`);
              break;
            } catch (error) {
              continue;
            }
          }

          if (!submitButton) {
            throw new Error('Could not find submit button for full login form');
          }

          console.log('Filling login credentials...');
          await usernameInput.fill(email);
          await page.waitForTimeout(1000);
          await passwordInput.fill(password);
          await page.waitForTimeout(1000);

          console.log('Clicking login button...');
          await submitButton.click();

        } else {
          console.log('=== PASSWORD-ONLY LOGIN MODE ===');
          console.log(`Using password selector: ${foundPasswordSelector}`);

          console.log('Filling password...');
          await passwordInput.fill(password);
          await page.waitForTimeout(1000);

          // Find login button for password-only mode
          const loginButtonSelectors = [
            'button:has-text("Se connecter")',
            'button:has-text("Connexion")',
            'button:has-text("Se conn")',
            'button[type="submit"]',
            'input[type="submit"]',
            '.dl-button-primary',
            'button.btn-primary',
            'form button'
          ];

          let loginButton = null;
          for (const selector of loginButtonSelectors) {
            try {
              loginButton = page.locator(selector).first();
              await loginButton.waitFor({ state: 'visible', timeout: 5000 });
              console.log(`✅ Login button found with selector: ${selector}`);
              break;
            } catch (error) {
              continue;
            }
          }

          if (!loginButton) {
            throw new Error('Could not find login button for password-only form');
          }

          console.log('Clicking login button...');
          await loginButton.click();
        }

        // Wait for navigation with extended timeout
        console.log('Waiting for navigation to calendar page...');
        try {
          await page.waitForURL(/pro.doctolib.fr\/calendar/i, { 
            waitUntil: 'networkidle', 
            timeout: 120000 
          });
          console.log(`✅ Successfully navigated to calendar. Current URL: ${page.url()}`);
        } catch (error) {
          console.error('CRITICAL ERROR: Failed to navigate to calendar after login attempt.');
          
          // Check current URL and page content for debugging
          console.log(`Current URL after login attempt: ${page.url()}`);
          
          // Take screenshot of current state
          const loginFailPath = path.join(screenshotDir, `login_failed_${Date.now()}.png`);
          await page.screenshot({ path: loginFailPath, fullPage: true });
          console.log(`📸 Login failure screenshot saved as ${loginFailPath}`);
          
          // Check if there are any error messages on the page
          try {
            const errorMessages = await page.locator('[class*="error"], [class*="alert"], .dl-alert').all();
            if (errorMessages.length > 0) {
              console.log('Found error messages on page:');
              for (const errorMsg of errorMessages) {
                const text = await errorMsg.textContent();
                if (text && text.trim()) {
                  console.log(`  - ${text.trim()}`);
                }
              }
            }
          } catch (errorCheckError) {
            console.log('Could not check for error messages:', errorCheckError.message);
          }
          
          throw new Error('Failed to complete login or navigate to calendar. Cannot proceed.');
        }

        // Handle potential identity verification modal
        await handleIdentityModal(page);
      }
    } else {
      console.log('Already on the calendar page. Proceeding to scrape.');
      await page.reload({ waitUntil: 'networkidle' });
      console.log('Page reloaded to ensure fresh state.');
      await handleIdentityModal(page);
    }

    // Continue with scraping logic...
    await performScraping(page, number);

  } catch (error) {
    console.error('An unhandled error occurred during scraping:', error);
    if (page) {
      const debugErrorPath = path.join(screenshotDir, `debug_error_${Date.now()}.png`);
      await page.screenshot({ path: debugErrorPath, fullPage: true });
      console.log(`📸 Debug error screenshot saved as ${debugErrorPath}`);
    }
    throw error;
  } finally {
    if (context) {
      await context.close();
      console.log('\n✅ Scraping complete and browser closed.');
    }
  }
}

async function handleIdentityModal(page) {
  console.log('Checking for identity verification modal...');
  try {
    const identityModalSelectors = [
      '.dl-modal-content:has-text("Confirmez votre identité")',
      '.dl-modal-content:has-text("vérification")',
      'div[class*="modal"]:has-text("CPS")',
      '.dl-modal-content',
      '[role="dialog"]'
    ];

    let modalFound = false;

    for (const modalSelector of identityModalSelectors) {
      try {
        const modal = page.locator(modalSelector).first();
        await modal.waitFor({ state: 'visible', timeout: 5000 });
        console.log(`Identity verification modal found with selector: ${modalSelector}`);
        modalFound = true;

        const closeButtonSelectors = [
          '.dl-modal-close-icon button',
          'button[aria-label="Fermer"]',
          '.dl-modal-content button:has-text("×")',
          '.dl-modal-content .dl-icon:has([data-icon-name*="xmark"])',
          '.dl-modal-close-icon',
          'button:has(.dl-icon[data-icon-name*="xmark"])',
          '[aria-label="Close"]',
          'button[class*="close"]'
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
          console.log('Close button not found, trying Escape key...');
          await page.keyboard.press('Escape');
          console.log('✅ Attempted to close modal with Escape key.');
        }

        await page.waitForTimeout(2000);
        break;

      } catch (error) {
        continue;
      }
    }

    if (!modalFound) {
      console.log('No identity verification modal found. Proceeding...');
    }

  } catch (error) {
    console.warn('Error handling identity verification modal:', error);
  }
}

async function performScraping(page, webhookUrl) {
  console.log('Starting appointment scraping...');
  
  const appointmentsData = [];
  const appointmentSelector = 'div.dc-event-inner';

  console.log('Waiting for appointment elements on the calendar...');
  try {
    await page.waitForSelector(appointmentSelector, { state: 'visible', timeout: 45000 });
    console.log('Appointment elements are visible on the calendar.');
  } catch (error) {
    console.warn('No appointment elements found on the main calendar page. The day might be empty.');
    console.log('✅ Script finished (no appointments found).');
    return;
  }

  const appointmentLocators = page.locator(appointmentSelector);
  const appointmentCount = await appointmentLocators.count();
  console.log(`Found ${appointmentCount} appointments to process.`);

  // Process appointments
  for (let i = 0; i < appointmentCount; i++) {
    const currentAppointment = appointmentLocators.nth(i);
    let patientName = 'Unknown Patient';
    let appointmentTime = 'Unknown Time';
    let appointmentDate = 'Unknown Date';
    let phoneNumber = 'N/A';

    try {
      const lastName = await currentAppointment.locator('[data-appointment-last-name]').getAttribute('data-appointment-last-name');
      const firstName = await currentAppointment.locator('[data-appointment-first-name]').getAttribute('data-appointment-first-name');
      appointmentTime = await currentAppointment.locator('[data-event-time]').getAttribute('data-event-time');
      patientName = `${lastName || ''} ${firstName || ''}`.trim();

      console.log(`\n--- Processing appointment ${i + 1}/${appointmentCount}: "${patientName}" at ${appointmentTime} ---`);

      await currentAppointment.click();

      const sidebarSelector = 'div.dl-left-navigation-bar';
      await page.waitForSelector(sidebarSelector, { state: 'visible', timeout: 20000 });

      // Extract date
      const dateInputSelector = 'input#appointment_start_date';
      try {
        const dateInput = page.locator(dateInputSelector);
        await dateInput.waitFor({ state: 'visible', timeout: 10000 });
        appointmentDate = await dateInput.getAttribute('value');
        console.log(`✅ Date found: ${appointmentDate}`);
      } catch (error) {
        console.warn(`⚠️ Could not find date for "${patientName}".`);
      }

      // Extract phone number
      const phoneNumberSelector = 'a#phone_number';
      try {
        const phoneLink = page.locator(phoneNumberSelector);
        await phoneLink.waitFor({ state: 'visible', timeout: 10000 });
        const href = await phoneLink.getAttribute('href');
        if (href) {
          phoneNumber = href.replace('tel:', '').replace(/\s/g, '');
        }
        console.log(`✅ Phone number found: ${phoneNumber}`);
      } catch (error) {
        console.warn(`⚠️ Could not find phone number for "${patientName}".`);
      }

      appointmentsData.push({
        patient: patientName,
        dateTime: `${appointmentDate} ${appointmentTime}`.trim(),
        phoneNumber: phoneNumber,
      });

      // Close sidebar
      const agendaButtonSelector = 'div.dl-permanent-entry-label:has-text("Agenda")';
      await page.locator(agendaButtonSelector).click();
      await page.waitForSelector(sidebarSelector, { state: 'hidden', timeout: 10000 });

    } catch (error) {
      console.error(`Error processing appointment ${i + 1} ("${patientName}"):`, error);
      appointmentsData.push({
        patient: patientName,
        dateTime: 'Error processing',
        phoneNumber: 'Error processing',
      });

      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(1000 + Math.random() * 500);
  }

  // Send results
  const successfulScrapes = appointmentsData.filter(
    data => data.phoneNumber && data.phoneNumber !== 'N/A' && data.phoneNumber !== 'Error processing'
  );

  console.log(`\n--- Final Results ---`);
  console.log(`✨ Total appointments processed: ${appointmentsData.length}`);
  console.log(`✅ Found ${successfulScrapes.length} appointments with valid phone numbers.`);

  if (successfulScrapes.length > 0) {
    console.table(successfulScrapes);

    // Send webhook
    try {
      console.log(`Sending ${successfulScrapes.length} appointments to webhook...`);
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(successfulScrapes),
      });

      if (response.ok) {
        console.log('✅ Webhook sent successfully!');
      } else {
        console.error(`❌ Failed to send webhook. Status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Webhook error:', error);
    }
  }
}

module.exports = { scrapeDoctolib };