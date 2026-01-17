# ERP Update System (Foxlink)

A comprehensive web-based platform for managing, reviewing, and deploying ERP system updates (Forms, Reports, SQL, Libraries).

## Features

*   **Request Management**: Submit, review, and track ERP update requests.
*   **Role-Based Access Control**:
    *   **User**: Submit requests.
    *   **Manager**: Approve/Reject requests.
    *   **DBA**: Execute deployments and manage database objects.
    *   **Admin**: System configuration and user management.
*   **Automated Deployment**:
    *   SFTP integration for deploying files to ERP servers.
    *   Automatic backup of existing files during deployment.
    *   Supports multiple file types (`.fmb`, `.rdf`, `.sql`, `.pll`, etc.).
*   **Authentication**:
    *   Integrated with Active Directory (LDAP).
    *   Local fallback authentication.
*   **File Management**:
    *   Secure file upload and download.
    *   Google Drive integration (Service Account).
*   **Security**:
    *   Role-based route protection.
    *   Input sanitization and path traversal prevention.
    *   Audit logs for sensitive actions.

## Tech Stack

*   **Frontend**: React, TypeScript, Tailwind CSS, Vite.
*   **Backend**: Node.js, Express.
*   **Database**: SQLite (SQL.js compatible wrapper).
*   **Infrastructure**: Docker support, Windows/Linux compatible.

## Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   NPM

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Richlai6995/erp_update_system.git
    cd erp_update_system
    ```

2.  **Install Dependencies**
    ```bash
    # Install root dependencies (if any)
    npm install

    # Install Backend
    cd server
    npm install

    # Install Frontend
    cd ../client
    npm install
    ```

3.  **Configuration**
    *   Copy `server/.env.example` to `server/.env`.
    *   Update the `.env` file with your LDAP, SMTP, and SFTP credentials.

### Running the Application

1.  **Start Backend**
    ```bash
    cd server
    node server.js
    # Runs on port 3003 by default
    ```

2.  **Start Frontend**
    ```bash
    cd client
    npm run dev
    # Runs on port 5173 by default
    ```

## Deployment

The system supports automated deployment via SFTP. Ensure the `ERP_FTP_*` environment variables are correctly set in `server/.env`.

## License

Internal Use Only - Foxlink
