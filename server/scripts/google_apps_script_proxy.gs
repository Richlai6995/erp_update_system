/**
 * Google Apps Script Proxy for ERP Approval System
 * 
 * Instructions:
 * 1. Create a new Google Apps Script project at https://script.google.com/
 * 2. Paste this code into 'Code.gs'.
 * 3. Update INTERNAL_API_BASE_URL to your internal server address (e.g., http://10.8.93.211:3003).
 * 4. Deploy as Web App:
 *    - Click "Deploy" -> "New deployment".
 *    - Select type: "Web app".
 *    - Description: "ERP Approval Proxy".
 *    - Execute as: "Me" (your account).
 *    - Who has access: "Anyone" (or specific domain users if enforced).
 * 5. Copy the "Web App URL" (ends with /exec).
 * 6. Set this URL as GAS_PROXY_URL in your server's .env file.
 */

// CONFIGURATION
// Replace this with your actual Internal Server IP/Hostname visible to the GCP Connector
var INTERNAL_API_BASE_URL = 'http://10.8.93.211:3003'; 

function doGet(e) {
  var params = e.parameter;
  var action = params.action; // 'approve' or 'reject'
  var token = params.token;
  
  if (!action || !token) {
    return HtmlService.createHtmlOutput("<h3>Error: Missing action or token.</h3>");
  }
  
  // Construct the target internal URL
  // Matches server/routes/public_approval.js routes
  var targetUrl = INTERNAL_API_BASE_URL + '/api/public/' + action + '?token=' + encodeURIComponent(token);
  
  Logger.log("Forwarding to: " + targetUrl);
  
  try {
    // Fetch from Internal API (Allowed via Serverless VPC Access if configured)
    var response = UrlFetchApp.fetch(targetUrl, {
      method: "get",
      muteHttpExceptions: true
    });
    
    var content = response.getContentText();
    var code = response.getResponseCode();
    
    // Return the HTML content directly to the user
    return HtmlService.createHtmlOutput(content)
      .setTitle("ERP Approval System")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // Optional
      
  } catch (error) {
    Logger.log("Error: " + error.toString());
    return HtmlService.createHtmlOutput(
      "<h3>Proxy Error</h3>" +
      "<p>Failed to connect to internal ERP system.</p>" + 
      "<p>Error details: " + error.toString() + "</p>"
    );
  }
}
