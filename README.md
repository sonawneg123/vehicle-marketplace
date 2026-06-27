# ReWheel — second-hand vehicle marketplace

A full-stack reference project: users sign up/log in with an email **or**
mobile number, list a vehicle for sale with photos and price, browse other
people's listings, and click **Buy** to send their contact details to the
seller. Sellers see every buyer who's interested in their vehicle, with
contact info, under "Buyer requests".

```
vehicle-marketplace/
├── database/test.sql      # MySQL schema (run this on RDS)
├── backend/                # Node.js + Express API
└── frontend/                # React (Vite) app
```

## 1. Database (RDS MySQL)

1. Create a MySQL 8 RDS instance inside a **private** subnet (no public access).
2. From the bastion host, tunnel or connect to RDS and run the schema:
   ```bash
   mysql -h <rds-endpoint> -u admin -p < database/test.sql
   ```
3. Create an app-specific DB user with limited grants instead of using the master user in production:
   ```sql
   CREATE USER 'app_user'@'%' IDENTIFIED BY 'a-strong-password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON vehicle_marketplace.* TO 'app_user'@'%';
   ```

## 2. Backend (private EC2, behind the internal load balancer)

```bash
cd backend
cp .env.example .env     # fill in DB_HOST (RDS endpoint), JWT_SECRET, etc.
npm install
npm start                 # listens on PORT (default 5000)
```
- Target group health check: `GET /health` → `200 OK`.
- Security group: only accept inbound traffic from the **internal load
  balancer's** security group on the app port, and from the **bastion's**
  security group on port 22.
- This instance has no public IP — you reach it only via the bastion (SSH)
  or via the internal load balancer (HTTP/API traffic from the frontend).

## 3. Frontend (private EC2, behind the external load balancer)

```bash
cd frontend
cp .env.example .env      # VITE_API_BASE_URL = http://<internal-lb-dns>/api
npm install
npm run build
npm run preview           # or serve dist/ with nginx
```
- Target group health check: `GET /` → `200 OK`.
- Security group: only accept inbound traffic from the **external load
  balancer's** security group, plus SSH from the bastion.
- `VITE_API_BASE_URL` must point at the **internal** load balancer's DNS
  name, so API calls never leave the VPC.

## 4. Bastion host

- Lives in the public subnet, with a security group that only allows SSH
  (port 22) from your office/home IP.
- Has no app code on it — it's purely a jump box:
  ```bash
  ssh -i key.pem ec2-user@<bastion-public-ip>
  ssh ec2-user@<frontend-or-backend-private-ip>   # from inside the bastion
  ```

## 5. Traffic flow

```
Internet → External ALB → Frontend EC2 (React, private)
                              ↓ (calls /api/*)
                          Internal LB → Backend EC2 (Node.js, private)
                                            ↓
                                       RDS MySQL (private)
```
Admin access only flows the other way: you → Bastion (public) → SSH → Frontend/Backend EC2 (private).

## Free public API used

The "Add vehicle" form calls the free, key-less
[NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/) directly from the
browser to populate the Brand and Model dropdowns, so sellers pick from a
real standardised list instead of typing free text.

## Core flows implemented

- **Sign up / log in** with email *or* mobile number + password (JWT auth).
- **List a vehicle**: brand/model (from the free API), year, price, fuel,
  transmission, km, description, up to 6 photos.
- **Browse**: anyone can view available listings and filter by brand,
  type, city, and max price.
- **Buy button**: logged-in buyers send an optional offer + message; this
  creates a row in `buy_requests` joining buyer ↔ seller ↔ vehicle.
- **Seller visibility**: the seller's "Buyer requests" page joins
  `buy_requests` back to `users` to show the buyer's name, email/mobile,
  and city, and lets them accept/reject/mark the sale completed.
