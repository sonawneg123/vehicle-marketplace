-- =====================================================================
-- Second-Hand Vehicle Marketplace - Database Schema
-- Target: MySQL 8.0+ (Amazon RDS)
-- File: test.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS vehicle_marketplace
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE vehicle_marketplace;

-- ---------------------------------------------------------------------
-- 1. USERS
-- A user can sign up/login with EITHER email OR mobile number (or both).
-- At least one of the two must be present - enforced with a CHECK below.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(100)        NOT NULL,
  email           VARCHAR(150)        NULL,
  mobile_number   VARCHAR(15)         NULL,
  password_hash   VARCHAR(255)        NOT NULL,
  city            VARCHAR(100)        NULL,
  is_active       TINYINT(1)          NOT NULL DEFAULT 1,
  created_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_mobile (mobile_number),
  CONSTRAINT chk_users_identifier
    CHECK (email IS NOT NULL OR mobile_number IS NOT NULL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. VEHICLES
-- A listing created by a seller (a user). Holds the sellable details.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id       BIGINT UNSIGNED     NOT NULL,
  title           VARCHAR(150)        NOT NULL,
  vehicle_type    ENUM('car','bike','scooter','truck','bus','other')
                                       NOT NULL DEFAULT 'car',
  brand           VARCHAR(100)        NOT NULL,
  model           VARCHAR(100)        NOT NULL,
  manufacture_year SMALLINT UNSIGNED  NOT NULL,
  price           DECIMAL(12,2)       NOT NULL,
  fuel_type       ENUM('petrol','diesel','electric','cng','hybrid','other')
                                       NOT NULL DEFAULT 'petrol',
  transmission    ENUM('manual','automatic') NOT NULL DEFAULT 'manual',
  kms_driven      INT UNSIGNED        NOT NULL DEFAULT 0,
  owners_count    TINYINT UNSIGNED    NOT NULL DEFAULT 1,
  registration_no VARCHAR(20)         NULL,
  city            VARCHAR(100)        NULL,
  description     TEXT                NULL,
  status          ENUM('available','sold','inactive')
                                       NOT NULL DEFAULT 'available',
  created_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_vehicles_seller
    FOREIGN KEY (seller_id) REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_vehicles_status (status),
  INDEX idx_vehicles_brand_model (brand, model),
  INDEX idx_vehicles_seller (seller_id),
  INDEX idx_vehicles_price (price)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. VEHICLE_PHOTOS
-- One vehicle can have many photos. photo_url points to wherever the
-- backend stores the uploaded file (local disk path / S3 key / URL).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_photos (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vehicle_id      BIGINT UNSIGNED     NOT NULL,
  photo_url       VARCHAR(500)        NOT NULL,
  is_primary      TINYINT(1)          NOT NULL DEFAULT 0,
  created_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_photos_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    ON DELETE CASCADE,

  INDEX idx_photos_vehicle (vehicle_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. BUY_REQUESTS
-- Created when a buyer clicks "Buy" / "I'm interested" on a vehicle.
-- Once created, the seller can see the buyer's contact details by
-- joining this table back to USERS on buyer_id.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buy_requests (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vehicle_id      BIGINT UNSIGNED     NOT NULL,
  buyer_id        BIGINT UNSIGNED     NOT NULL,
  seller_id       BIGINT UNSIGNED     NOT NULL,
  message         VARCHAR(500)        NULL,
  offer_price     DECIMAL(12,2)       NULL,
  status          ENUM('pending','accepted','rejected','completed')
                                       NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_requests_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_requests_buyer
    FOREIGN KEY (buyer_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_requests_seller
    FOREIGN KEY (seller_id) REFERENCES users(id)
    ON DELETE CASCADE,

  -- a buyer can only raise one active request per vehicle
  UNIQUE KEY uq_request_vehicle_buyer (vehicle_id, buyer_id),
  INDEX idx_requests_seller (seller_id),
  INDEX idx_requests_buyer (buyer_id)
) ENGINE=InnoDB;

-- =====================================================================
-- Sample seed data (safe to delete - useful for local testing)
-- =====================================================================
INSERT INTO users (full_name, email, mobile_number, password_hash, city) VALUES
('Asha Rao', 'asha@example.com', '9000000001', '$2b$10$replace_with_real_bcrypt_hash', 'Hyderabad'),
('Vikram Singh', 'vikram@example.com', '9000000002', '$2b$10$replace_with_real_bcrypt_hash', 'Bengaluru');

INSERT INTO vehicles (seller_id, title, vehicle_type, brand, model, manufacture_year, price, fuel_type, transmission, kms_driven, owners_count, city, description) VALUES
(1, 'Well maintained Honda City', 'car', 'Honda', 'City', 2019, 850000.00, 'petrol', 'automatic', 32000, 1, 'Hyderabad', 'Single owner, all service records available.'),
(2, 'Royal Enfield Classic 350', 'bike', 'Royal Enfield', 'Classic 350', 2021, 165000.00, 'petrol', 'manual', 8000, 1, 'Bengaluru', 'Excellent condition, recently serviced.');
