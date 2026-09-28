# Shop QA Lab

A small local shop for practising UI testing, API testing and database checks. The interesting part is checking whether the tests detect a defect, rather than just getting a green run.

## Run the shop

Use Node.js 24 or newer.

```sh
npm ci
npm start
```

Open http://127.0.0.1:4173. Demo accounts: `asha@example.com` and `ravi@example.com`, both with password `practice123`.

The shop sells three items. It has sign-in, search, a cart and simulated checkout. There is no real payment, shipping, tax or stock reservation. Data is stored locally in `.data/shop.sqlite`.

## About this project

This is an AI-assisted practice project, not client work. The app was built for this repository. The deliberately seeded defects are exercises, not discoveries in a production product. Commit dates reflect when this repository was created.

The app only listens on the local loopback address. It is a testing sandbox, not a production storefront.
