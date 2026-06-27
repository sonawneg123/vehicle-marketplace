# Three-Tier Architecture — End-to-End AWS Deployment Guide

This README walks through deploying the architecture in your diagram,
step by step, using only the AWS Console (no Terraform/CloudFormation).
Each step explains *what* you're building and *why*, in plain language.

---

## 1. What we're building (in plain English)

A visitor types your domain name into their browser. Here's the journey
their request takes, matching the diagram:

```
User's browser
   ↓
Route 53 (DNS — turns your domain name into an IP)
   ↓
CloudFront (CDN — caches content close to the user, also our HTTPS endpoint)
   ↓
External Load Balancer  (internet-facing, "EXLB" in the diagram)
   ↓
Frontend servers — Nginx, port 80, 2 copies across us-east-1a / us-east-1b
   ↓ (Nginx forwards /api calls onward)
Internal Load Balancer  ("INLB" — never reachable from the internet)
   ↓
Backend servers — Python/Flask app, port 5000, 2 copies across us-east-1a / us-east-1b
   ↓
MySQL (RDS) for data  +  Redis (ElastiCache) for caching/sessions
```

Both server tiers run in an **Auto Scaling Group (ASG)**, so AWS adds or
removes servers automatically based on load, and replaces any server
that becomes unhealthy.

Two more things sit off to the side:
- **Bastion hosts** (the small locked server icons in the public
  subnets) — the *only* way anyone can SSH into the private servers.
  You connect to a bastion first, then "hop" from there to the frontend
  or backend instances. Nothing private is ever exposed directly to SSH
  from the internet.
- **Dynatrace → PagerDuty** — Dynatrace watches every server and the app
  itself; if something breaks, it tells PagerDuty, which pages whoever
  is on call.

---

## 2. Before you start

- An AWS account with permission to create VPCs, EC2, RDS, ElastiCache, ALB, CloudFront, Route 53.
- A domain name (either bought through Route 53, or bought elsewhere with its nameservers pointed at a Route 53 hosted zone).
- An SSH key pair (create one in EC2 → Key Pairs if you don't have one).
- We'll build everything in **us-east-1**, matching the diagram.
- Your frontend code (built React/HTML/CSS/JS files) and backend code (Flask app) ready to copy onto the servers — or in a Git repo you can `git clone` from the instances.

> If your backend is actually Node.js (from an earlier project), every
> step below is identical — just swap "install Python + gunicorn" for
> "install Node.js + pm2" and keep the same port (5000) and health-check
> path.

---

## 3. Step 1 — Create the VPC and subnets

This is the foundation — a private network inside AWS, split into 8
small networks ("subnets") so each tier is isolated from the others.

Go to **VPC console → Your VPCs → Create VPC**:
- Name: `three-tier-vpc`
- IPv4 CIDR: `10.0.0.0/16`

Now create 8 subnets (**VPC → Subnets → Create subnet**, all inside `three-tier-vpc`):

| Subnet name | Availability Zone | CIDR block | What lives here |
|---|---|---|---|
| public-a | us-east-1a | 10.0.0.0/24 | Bastion host |
| public-b | us-east-1b | 10.0.1.0/24 | Bastion host |
| frontend-a | us-east-1a | 10.0.2.0/24 | Nginx / frontend app |
| frontend-b | us-east-1b | 10.0.3.0/24 | Nginx / frontend app |
| backend-a | us-east-1a | 10.0.4.0/24 | Flask / backend app |
| backend-b | us-east-1b | 10.0.5.0/24 | Flask / backend app |
| db-mysql | us-east-1a | 10.0.6.0/24 | RDS MySQL |
| db-redis | us-east-1b | 10.0.7.0/24 | ElastiCache Redis |

> RDS and ElastiCache both require their "subnet group" to span **at
> least two Availability Zones**, even if you're not paying for
> Multi-AZ. So when you create the DB subnet groups in step 6, include
> *both* `db-mysql` and `db-redis` subnets in each group — that
> satisfies AWS's requirement and costs nothing extra.

---

## 4. Step 2 — Internet access: Internet Gateway, NAT Gateway, route tables

- **VPC → Internet Gateways → Create** → name it `three-tier-igw` → **Attach to VPC** (`three-tier-vpc`).
- **VPC → NAT Gateways → Create NAT Gateway**:
  - Subnet: `public-a`
  - Allocate a new Elastic IP
  - Name: `nat-regional`

Now two route tables:

**Public-RT** (for the public subnets):
- VPC → Route Tables → Create → name `Public-RT`, VPC = `three-tier-vpc`
- Edit routes → add `0.0.0.0/0` → target = `three-tier-igw`
- Edit subnet associations → attach `public-a`, `public-b`

**Private-RT** (for everything else):
- Create another route table named `Private-RT`
- Edit routes → add `0.0.0.0/0` → target = `nat-regional`
- Edit subnet associations → attach `frontend-a`, `frontend-b`, `backend-a`, `backend-b`, `db-mysql`, `db-redis`

This means: public subnets talk to the internet directly through the
Internet Gateway. Everything private reaches the internet (for software
updates, etc.) only through the NAT Gateway, and nothing from the
internet can initiate a connection *into* them.

---

## 5. Step 3 — Security groups (who can talk to whom)

Create these in **EC2 → Security Groups**. Each one only allows the
minimum traffic it actually needs:

| Security group | Inbound rule | Purpose |
|---|---|---|
| `sg-bastion` | SSH (22) from **your home/office IP only** | Jump box access |
| `sg-exlb` | HTTP (80) / HTTPS (443) from `0.0.0.0/0` | Public-facing load balancer |
| `sg-frontend` | Port 80 from `sg-exlb`; SSH (22) from `sg-bastion` | Frontend Nginx servers |
| `sg-inlb` | Port 80 from `sg-frontend` | Internal load balancer |
| `sg-backend` | Port 5000 from `sg-inlb`; SSH (22) from `sg-bastion` | Backend Flask servers |
| `sg-mysql` | Port 3306 from `sg-backend` | RDS MySQL |
| `sg-redis` | Port 6379 from `sg-backend` | ElastiCache Redis |

Tip: when you fill in the "source" of a rule, you can pick another
security group by name instead of an IP range — that's how `sg-frontend`
allows traffic "from `sg-exlb`" regardless of which exact server IPs the
load balancer is using today.

---

## 6. Step 4 — Bastion hosts (your only way in)

In **each** public subnet, launch a small EC2 instance:
- AMI: Amazon Linux 2023
- Instance type: `t3.micro` (this box does nothing heavy, it's just a doorway)
- Subnet: `public-a` (and a second one in `public-b`)
- Auto-assign public IP: **Yes**
- Security group: `sg-bastion`
- Key pair: the one you created earlier

To reach a private server later, you'll SSH to the bastion first, then
SSH again from inside it to the private instance's *private* IP:
```bash
ssh -i your-key.pem ec2-user@<bastion-public-ip>
# now you're inside the bastion
ssh ec2-user@10.0.2.x   # hops to a frontend or backend server
```
(Easier version: use `ssh -A` on your first command so your key forwards
through automatically and you don't need to copy it onto the bastion.)

---

## 7. Step 5 — Databases: MySQL (RDS) and Redis (ElastiCache)

**MySQL:**
- RDS console → Subnet groups → Create → include `db-mysql` and `db-redis` subnets
- RDS → Create database → Standard create → MySQL 8.0
- Templates: Production (or Dev/Test to save cost while testing)
- DB instance identifier: `threetier-mysql`
- Set a master username/password (or let AWS manage it via Secrets Manager — recommended)
- VPC: `three-tier-vpc`, subnet group: the one you just made, **no public access**
- Security group: `sg-mysql`
- Note the **endpoint** shown after creation — your backend app will use this as `DB_HOST`

**Redis:**
- ElastiCache console → Redis clusters → Create
- Cluster mode: Disabled (single primary is fine to start)
- Node type: `cache.t3.micro`
- Subnet group: create one using the same two DB subnets
- Security group: `sg-redis`
- Note the **primary endpoint** — your backend app will use this as `REDIS_HOST`

---

## 8. Step 6 — Backend tier (Flask app, port 5000)

**a. Prepare the server setup as a Launch Template** (EC2 → Launch Templates → Create):
- AMI: Amazon Linux 2023, instance type e.g. `t3.small`
- Security group: `sg-backend`
- No public IP (it's private)
- Under **Advanced → User data**, paste a startup script that installs
  Python, pulls your code, and starts it as a service on port 5000 — for
  example:
  ```bash
  #!/bin/bash
  dnf install -y python3 python3-pip git
  git clone https://github.com/your-org/your-backend-repo.git /opt/app
  cd /opt/app
  pip3 install -r requirements.txt gunicorn
  cat > /etc/systemd/system/backend.service << 'EOF'
  [Unit]
  Description=Flask backend
  After=network.target

  [Service]
  WorkingDirectory=/opt/app
  Environment="DB_HOST=<your-mysql-endpoint>"
  Environment="REDIS_HOST=<your-redis-endpoint>"
  ExecStart=/usr/local/bin/gunicorn -b 0.0.0.0:5000 app:app
  Restart=always

  [Install]
  WantedBy=multi-user.target
  EOF
  systemctl enable --now backend.service
  ```

**b. Create the Backend Target Group** (EC2 → Target Groups → Create):
- Target type: Instances
- Protocol/port: HTTP / 5000
- VPC: `three-tier-vpc`
- Health check path: `/health` (make sure your Flask app has this route returning `200 OK`)

**c. Create the Internal Load Balancer:**
- EC2 → Load Balancers → Create → Application Load Balancer
- Name: `internal-lb`, Scheme: **Internal**
- Subnets: `backend-a`, `backend-b`
- Security group: `sg-inlb`
- Listener: HTTP 80 → forward to the Backend Target Group

**d. Create the Auto Scaling Group:**
- EC2 → Auto Scaling Groups → Create → use the Launch Template from step (a)
- Subnets: `backend-a`, `backend-b`
- Attach to the Backend Target Group
- Desired/Min/Max capacity: e.g. 2 / 2 / 4
- Scaling policy: target tracking on CPU at ~60%

---

## 9. Step 7 — Frontend tier (Nginx, port 80)

**a. Launch Template for the frontend:**
- Security group: `sg-frontend`, no public IP
- User data installs Nginx, deploys your built frontend files, and
  configures Nginx to serve them on port 80 while forwarding any `/api/`
  path to the internal load balancer:
  ```bash
  #!/bin/bash
  dnf install -y nginx git
  git clone https://github.com/your-org/your-frontend-repo.git /tmp/site
  cp -r /tmp/site/dist/* /usr/share/nginx/html/
  cat > /etc/nginx/conf.d/app.conf << 'EOF'
  server {
      listen 80;
      root /usr/share/nginx/html;
      location /health { return 200 "ok"; }
      location /api/ {
          proxy_pass http://<internal-lb-dns-name>/;
      }
      location / { try_files $uri /index.html; }
  }
  EOF
  systemctl enable --now nginx
  ```

**b. Frontend Target Group:** HTTP / port 80, health check path `/health`.

**c. External Load Balancer:**
- Scheme: **Internet-facing** (this is the one part that *must* sit in
  the **public** subnets, `public-a` / `public-b` — even though it sends
  traffic onward to servers in the private frontend subnets)
- Security group: `sg-exlb`
- Listener: HTTP 80 (and HTTPS 443 once you have a certificate — see step 8) → forward to Frontend Target Group

**d. Auto Scaling Group** for the frontend, same idea as the backend:
subnets `frontend-a` / `frontend-b`, attached to the Frontend Target Group.

---

## 10. Step 8 — CloudFront + HTTPS certificate

1. **AWS Certificate Manager** (region must be **us-east-1** for CloudFront) → Request a public certificate for your domain → validate it (DNS validation is easiest if your domain is already in Route 53 — ACM can add the validation record for you with one click).
2. **CloudFront → Create distribution**:
   - Origin domain: your External Load Balancer's DNS name
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Cache policy: for a dynamic app, use **CachingDisabled** (or a custom policy that forwards all headers, cookies, and query strings) so logged-in pages and API responses aren't cached incorrectly
   - Attach the ACM certificate, add your domain as an "Alternate domain name (CNAME)"

---

## 11. Step 9 — Route 53

- Route 53 → Hosted zones → your domain
- Create record → Type **A** → toggle **Alias** → route traffic to **CloudFront distribution** → pick the one you just made

That's the whole chain wired up: domain → CloudFront → External ALB → Nginx → Internal ALB → Flask → MySQL/Redis.

---

## 12. Step 10 — Monitoring (Dynatrace) and alerting (PagerDuty)

1. Sign up for a Dynatrace environment (SaaS).
2. Add one more line to **both** launch templates' user data to install
   the Dynatrace OneAgent (Dynatrace gives you this exact install
   command in **Deploy Dynatrace → Start installation → Linux**):
   ```bash
   wget -O Dynatrace-OneAgent.sh "https://<your-environment>.live.dynatrace.com/api/v1/deployment/installer/agent/unix/default/latest?Api-Token=<your-token>"
   /bin/sh Dynatrace-OneAgent.sh
   ```
   OneAgent automatically discovers Nginx, your Python process, host
   metrics, and network connections — no extra config needed.
3. In **PagerDuty**, create a Service (e.g. "Three-Tier-App"), and copy its **Integration Key**.
4. In **Dynatrace → Settings → Integration → Problem notifications**, add a PagerDuty notification and paste that integration key in.

Now if a server runs out of memory, a process crashes, or response
times spike, Dynatrace raises a "problem," PagerDuty pages whoever is
on call, and the on-call engineer gets a phone alert.

---

## 13. Step 11 — Test everything end to end

- Visit `https://yourdomain.com` in a browser — you should see your frontend.
- Open the browser's network tab and trigger an action that calls your API — confirm it round-trips through Nginx → Internal LB → Flask.
- SSH test: from your laptop → bastion → a frontend or backend private IP.
- Resilience test: terminate one backend instance manually — the ASG should launch a replacement, and the Internal LB should stop sending it traffic the moment it goes unhealthy.
- Alerting test: trigger a fake problem in Dynatrace (or stop a service on a test instance) and confirm a PagerDuty page arrives.

---

## 14. Costs to keep in mind

These are the pieces that cost money even at low traffic:
- NAT Gateway (hourly charge **plus** per-GB data charge — this is usually the most surprising line item)
- 2 Application Load Balancers
- RDS MySQL + ElastiCache Redis (even at the smallest size, they run 24/7)
- EC2 instances in both Auto Scaling Groups
- CloudFront and Route 53 (both cheap, pay-per-use)
- Dynatrace (priced separately by their own plan)

For a learning/test environment, shut down or delete things you're not
actively using — RDS and NAT Gateways are the two easiest to forget
about.

## 15. Tearing it all down (in this order, to avoid dependency errors)

1. Disable, then delete the CloudFront distribution (disabling takes a few minutes to propagate before it can be deleted).
2. Delete the Route 53 record.
3. Delete both Load Balancers and Target Groups.
4. Set both Auto Scaling Groups' min/desired/max to 0, wait for instances to terminate, then delete the ASGs and Launch Templates.
5. Terminate the bastion instances.
6. Delete the RDS instance (skip the final snapshot only if this was just for testing) and the ElastiCache cluster.
7. Delete the NAT Gateway, then release its Elastic IP.
8. Delete the route tables, subnets, Internet Gateway, and finally the VPC.

---

## Quick reference: diagram → AWS resource

| In the diagram | AWS resource |
|---|---|
| Client Browser | End user, nothing to build |
| Route53 | Route 53 hosted zone + A/Alias record |
| Cloud Front | CloudFront distribution |
| EX L B | Application Load Balancer, internet-facing |
| NGINX boxes (port 80) | EC2 instances in an Auto Scaling Group, frontend subnets |
| IN L B | Application Load Balancer, internal |
| Python boxes (port 5000) | EC2 instances in an Auto Scaling Group, backend subnets |
| AWS ASGs | Auto Scaling Groups (one per tier) |
| M (MySQL) | Amazon RDS for MySQL |
| R (Redis) | Amazon ElastiCache for Redis |
| Locked EC2 in public subnets | Bastion hosts |
| Masked figure at the bottom | The admin/DevOps engineer connecting in over SSH through the bastion |
| dynatrace | Dynatrace SaaS monitoring (OneAgent on every instance) |
| PagerDuty | PagerDuty alerting, triggered by Dynatrace |
