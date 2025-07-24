const { chromium } = require('playwright');
const path = require('path');

async function scrapeDoctolib() {
  let context; // BrowserContext for persistent session
  let page;

  try {
    const userDataDir = path.join(__dirname, 'user_data');
    console.log(`Launching browser with persistent user data directory: ${userDataDir}`);

    // Launch the browser with a persistent context to maintain login sessions
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true, // Setat pe true pentru rularea pe server
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

    // --- 1. LOGIN OR NAVIGATE ---
    // Check if we are already on the calendar page. If not, navigate and log in.
    if (!page.url().includes('pro.doctolib.fr/calendar')) {
      console.log('Not on the calendar page. Starting login process...');
      await page.goto('https://pro.doctolib.fr/signin', { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Double-check if the navigation immediately redirected to the calendar (already logged in)
      if (page.url().includes('pro.doctolib.fr/calendar')) {
        console.log('Detected that the browser is already logged in. Skipping login steps.');
      } else {
        // --- Handle Cookie Consent ---
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

        // --- Perform Login ---
        const DOCTOLIB_USERNAME = 'robin.chapoutot@hotmail.com'; // Replace with your username
        const DOCTOLIB_PASSWORD = 'Yourtarget83-'; // Replace with your password
        
        // Check for the password-only login scenario
        const usernameInput = page.locator('input#username');
        const passwordInput = page.locator('input#password');
        
        if (await passwordInput.isVisible() && !(await usernameInput.isVisible({timeout: 2000}))) {
            // SCENARIO: Password-only login
            console.log('Password-only login form detected.');
            console.log('Entering password...');
            await passwordInput.fill(DOCTOLIB_PASSWORD);

            console.log('Clicking "Se connecter" button...');
            await page.locator('button:has-text("Se connecter")').click();

        } else {
            // SCENARIO: Full login with username and password
            console.log('Full login form detected.');
            console.log('Waiting for login form elements...');
            await usernameInput.waitFor({ state: 'visible' });
            await passwordInput.waitFor({ state: 'visible' });
            await page.waitForSelector('button[type="submit"].dl-button-primary', { state: 'visible' });
    
            console.log('Entering login credentials...');
            await usernameInput.fill(DOCTOLIB_USERNAME);
            await passwordInput.fill(DOCTOLIB_PASSWORD);
    
            console.log('Clicking login button...');
            await page.click('button[type="submit"].dl-button-primary');
        }

        // --- Wait for navigation to calendar (handles post-login/2FA redirect) ---
        console.log('Waiting for navigation to agenda page...');
        try {
            await page.waitForURL(/pro.doctolib.fr\/calendar/i, { waitUntil: 'networkidle', timeout: 360000 });
            console.log(`Successfully navigated to agenda page. Current URL: ${page.url()}`);
        } catch (error) {
            console.error('CRITICAL ERROR: Failed to navigate to the agenda page after login attempt.', error);
            await page.screenshot({ path: 'login_or_agenda_navigation_error.png' });
            throw new Error('Failed to complete login or navigate to agenda. Cannot proceed.');
        }
      }
    } else {
        console.log('Already on the calendar page. Proceeding to scrape.');
        await page.reload({ waitUntil: 'networkidle' });
        console.log('Page reloaded to ensure fresh state.');
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
      const webhookUrl = 'https://robin01.app.n8n.cloud/webhook/doctolib-appointments';
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
        await page.screenshot({ path: 'critical_error.png' });
    }
  } finally {
    if (context) {
      await context.close();
      console.log('\n✅ Scraping complete and browser closed.');
    }
  }
}

// Rulează doar dacă fișierul este executat direct
if (require.main === module) {
  scrapeDoctolib()
    .then(() => {
      console.log('✅ Scraping process finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Scraping process failed:', error);
      process.exit(1);
    });
}

module.exports = { scrapeDoctolib };