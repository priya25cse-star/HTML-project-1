# Project Charter: Gourmet au Catering

## Project overview

Gourmet au Catering is a responsive catering request website built for the university Web Project 3rd Evaluation. Customers explore a seasonal menu, create order requests and submit event bookings. Authorized staff maintain the menu and manage requests through an admin dashboard.

## Problem statement

A static catering website can describe dishes but cannot persist requests, maintain current menu availability or give staff a structured way to manage customer enquiries. This project connects the existing catering interface to persistent storage and authenticated management APIs.

## Objectives

- Provide an accessible experience on mobile, tablet and desktop.
- Let customers search/filter dishes, manage quantities and submit contactable order requests.
- Collect catering event details and store booking requests reliably.
- Give authorized staff complete menu, booking and order management.
- Demonstrate all four university parameters: external API fetching/display, Node.js/Express, local JSON APIs, and MongoDB CRUD.
- Protect credentials and private customer information through server-side authorization and validation.

## Scope

Included: homepage, menu, checkout, booking form, confirmation page, staff authentication/dashboard, menu CRUD, booking/order CRUD, recipe inspiration, documentation and automated tests.

Excluded: online payments, OTP verification, SMS/email delivery, delivery tracking and automatic booking confirmation. A submitted request remains pending until staff update its status.

## Technologies

- HTML5, CSS3 and vanilla JavaScript for the frontend.
- Node.js 24 or newer and Express for HTTP APIs and intended frontend hosting.
- MongoDB Atlas and Mongoose for bookings and orders.
- Node.js `fs/promises` for actual local JSON menu persistence.
- dotenv, Helmet and express-rate-limit for configuration and request protection.
- TheMealDB for external recipe inspiration, separate from purchasable menu items.
- Node's test runner, Supertest, Playwright/Chrome and html-validate for verification.
- Git/GitHub and a Postman Native Git collection for source control and API demonstrations.

## Major functionality

Customers can search and filter dishes, view availability, maintain cart quantities, submit an order with their name/contact number, and request event catering. The server computes order prices from the actual menu. Staff can view requests, update statuses, delete selected records with confirmation, and add/edit/delete menu items.

## Architecture

The browser loads the existing HTML/CSS/JavaScript pages from Express and calls same-origin `/api` endpoints. `src/app.js` assembles middleware and routes; `server.js` handles listening, database startup/retries and shutdown. Routes delegate validation, JSON storage and persistence to modules under `src/`.

Admin authentication uses server-side sessions, signed HttpOnly cookies and CSRF verification. Private booking/order reads and menu/request modification endpoints require authorization. Public submission responses contain receipts rather than customer contact details.

## Database and file storage

- `data/menu.json` contains uniquely identified dishes, categories, descriptions, prices, image paths and availability. Serialized writes and atomic file replacement preserve disk data.
- MongoDB stores bookings with event/customer details, status and timestamps.
- MongoDB stores new orders with customer name/contact number, item/price snapshots, quantities, total, status and timestamps. Historical orders without contact details remain readable and manageable without a migration.
- Tests use temporary menu files and uniquely named disposable database collections. Normal customer records are preserved.

## API integration

Express fetches TheMealDB recipe suggestions with a timeout and cache. The frontend displays the suggestions and provider links. Suggestions cannot be added to the catering cart. Missing results and network failures have visible fallback messages.

## Expected outcomes

A working, documented catering request application demonstrating the university requirements with reproducible API/browser tests. The application should retain its original branding and team credits, persist real requests, and keep customer records private. Successful verification must be recorded from actual test execution.

## Team

**Pranav, Priya, Jyoti**

No individual roles or contributions are assigned here because the repository does not establish them.

## Details to be supplied by the team

- Institution/department: **[to be supplied]**
- Course code and section: **[to be supplied]**
- Faculty/project supervisor: **[to be supplied]**
- Submission date: **[to be supplied]**
