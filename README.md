# Food Ingredient Health Analyzer

This project helps users look up a food product and view a simple ingredient-based health score. The app includes a React + Vite frontend, a Spring Boot backend, and a MySQL database connection for stored product and ingredient data.

## Tech Stack

- Frontend: React, Vite, Axios
- Backend: Java 17, Spring Boot, Maven
- Database: MySQL

## Prerequisites

Install these before running the project:

- Visual Studio Code
- Node.js 18 or newer
- Java 17
- MySQL 8

You can verify your installs with:

```powershell
node -v
npm -v
java -version
mysql --version
```

## 1. Configure the Backend Database (Optional)

The backend reads its database connection from `backend/src/main/resources/application.properties`.

You can update those values so they point to a MySQL database you can access on your computer:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/food_health?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
spring.datasource.username=your_mysql_username
spring.datasource.password=your_mysql_password

spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
```

Notes:

- Create the database first in MySQL. Example: `CREATE DATABASE food_health;`
- `spring.jpa.hibernate.ddl-auto=update` lets Spring create or update tables automatically.
- If you want to keep using the current database settings already in the file, you can, but you can also replace them with local MySQL credentials. The choice is yours.

## 2. Start the Backend

Open a terminal in the `backend` folder:

```powershell
cd backend
```

run:

```powershell
.\mvnw.cmd spring-boot:run
```

The backend should start on `http://localhost:8080`.

## 3. Start the Frontend

Open a second terminal in the `frontend` folder:

```powershell
cd frontend
npm install
npm run dev
```

Vite should start the frontend on `http://localhost:5173`.

## 4. Open the App

Once both servers are running, open `http://localhost:5173`.

From there you can:

- Search for a product by name
- Enter a barcode number manually
- Upload a barcode image
- Use your camera for live barcode scanning

## How the Frontend Connects to the Backend

The frontend currently sends requests to `http://localhost:8080/api/products`. That URL is defined in `frontend/src/services/productService.js`.

The backend also allows requests from `http://localhost:5173`, so the default local setup is already aligned.

## Helpful Commands

Frontend:

```powershell
cd frontend
npm run dev
cd ..
```

Backend:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
cd ..
```

## Troubleshooting

### Backend will not start

Check:

- Java 17 is installed
- MySQL is running
- The database in `application.properties` exists
- The MySQL username and password are correct

### Frontend cannot reach the backend

Check:

- The backend is running on `localhost:8080`
- The frontend is running on `localhost:5173`
- No other app is using port `8080` or `5173`

### Barcode scanning does not work

Check:

- Your browser has camera permission
- You are using a supported modern browser (Google Chrome works best)
- The barcode image is clear and well lit

## Summary

To run this project locally:

1. Install Node.js, Java 17, and MySQL.
2. Update `backend/src/main/resources/application.properties` with local MySQL credentials. (Optional)
3. Start the backend from `backend/`.
4. Start the frontend from `frontend/`.
5. Open `http://localhost:5173` in your browser.
