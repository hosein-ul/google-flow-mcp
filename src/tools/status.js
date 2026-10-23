import { isConnected, getPage } from '../browser/connect.js';
import { checkAuthStatus } from '../navigation/flow-navigator.js';
import { logger } from '../utils/logger.js';

export async function handleStatus() {
  const status = {
    connected: isConnected(),
    authenticated: false,
    currentUrl: null,
    pageTitle: null,
    inProject: false,
    message: ''
  };

  if (isConnected()) {
    try {
      const page = getPage();
      const auth = await checkAuthStatus(page);
      status.authenticated = auth.authenticated;
      status.currentUrl = page.url();
      status.pageTitle = await page.title().catch(() => '');
      status.inProject = status.currentUrl.includes('/project/');
      
      if (!status.authenticated) {
        status.message = 'Chrome is open, but Google Sign-In is required in the browser.';
      } else if (status.inProject) {
        status.message = 'Ready. Connected to Google Flow project canvas.';
      } else {
        status.message = 'Ready. Connected to Google Flow homepage.';
      }
    } catch (err) {
      status.error = err.message;
    }
  } else {
    status.message = 'Browser is not connected. Call flow_connect to connect.';
  }

  logger.info('Status response', status);
  return status;
}
