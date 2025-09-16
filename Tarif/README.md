# French Role-Based Webpage

## Description
This project is a web application that allows users to select a role and authenticate themselves to access specific downloadable content. The roles include Tarif Grossiste, Hexapage Price, Koesio Price, Tarif KYOXpert, and Public Price. Each role has its own downloadable PDF file, and access is restricted based on the user's role.

## Features
- Role selection for different pricing categories.
- Password authentication for secure access.
- Redirection to the appropriate download page after successful login.
- Downloadable files based on user roles.
- A visually appealing design with a dye pattern and logo.

## Project Structure
```
french-role-based-webpage
├── public
│   ├── index.html          # Main HTML page
│   ├── logo.svg           # Logo for the webpage
│   └── styles
│       └── dye-pattern.css # CSS for styling the webpage
├── src
│   ├── app.js             # Main JavaScript file for app logic
│   ├── auth.js            # Authentication functions
│   ├── roles.js           # Role definitions and access control
│   └── downloads
│       ├── grossiste.pdf   # PDF for Tarif Grossiste role
│       ├── hexapage.pdf    # PDF for Hexapage Price role
│       ├── koesio.pdf      # PDF for Koesio Price role
│       ├── kyoxpert.pdf    # PDF for Tarif KYOXpert role
│       └── public.pdf      # PDF for Public Price role
├── package.json            # NPM configuration file
└── README.md               # Project documentation
```

## Setup Instructions
1. Clone the repository to your local machine.
2. Navigate to the project directory.
3. Run `npm install` to install the necessary dependencies.
4. Open `public/index.html` in your web browser to access the application.

## Usage Guidelines
- Select a role from the available options.
- Enter the required password for authentication.
- Upon successful login, you will be redirected to the download page corresponding to your selected role.
- Click on the link to download the PDF file associated with your role.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.