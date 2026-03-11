# Deployment Instructions for ScalaHost

This project is a React application with a small Node.js server to serve the static files in production.

## Prerequisites
- Node.js installed on your ScalaHost server.
- Access to the ScalaHost control panel (cPanel or similar).

## Deployment Steps

1. **Build the Application Locally (Optional but Recommended):**
   If you have Node.js installed locally, run:
   ```bash
   npm install
   npm run build
   ```
   This creates a `dist` folder.

2. **Prepare the ZIP:**
   - Download the project ZIP from AI Studio.
   - Ensure the `dist` folder is included if you built it locally, or prepare to build it on the server.

3. **Upload to ScalaHost:**
   - Upload the ZIP file to your server (usually via File Manager in cPanel or FTP).
   - Extract the contents into your application directory.

4. **Install Dependencies on Server:**
   Open a terminal/SSH on your ScalaHost server and run:
   ```bash
   npm install --production
   ```

5. **Build on Server (if not done locally):**
   ```bash
   npm run build
   ```

6. **Set Environment Variables:**
   In your ScalaHost dashboard (Node.js selector or environment settings), add the following variable:
   - `API_KEY`: Your Gemini API key.

7. **Start the Application:**
   Set the "Application startup file" to `server.js` or run:
   ```bash
   npm start
   ```

## Security Note
The current implementation calls the Gemini API directly from the client. For better security, consider moving the API calls to the `server.js` file to keep your `API_KEY` hidden from the browser.
