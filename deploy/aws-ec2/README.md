# Deploy LoadMitra on AWS (free tier)

One EC2 instance runs the API and both portals behind nginx with free Let's Encrypt HTTPS.
MongoDB stays on Atlas (free M0). S3 holds documents and CloudWatch collects logs and metrics.

```
Browser ──HTTPS──▶ nginx on EC2 (t4g.micro, ap-southeast-2)
                    ├─ api.<ip>.sslip.io      → API      :4000 ──▶ MongoDB Atlas M0 (Sydney)
                    ├─ ship.<ip>.sslip.io     → shipper  :8080
                    └─ captain.<ip>.sslip.io  → captain  :8081
                   PM2 logs ─▶ CloudWatch Logs     instance role ─▶ S3 bucket (documents)
```

`<ip>` is your Elastic IP with dashes, e.g. `13-233-10-20`. [sslip.io](https://sslip.io) resolves it for free, so no domain purchase is needed.

## Before you start: what "free" means

- **Account created before 15 July 2025 (legacy free tier):** for 12 months you get 750 h/month of t2.micro/t3.micro, 30 GB EBS, 750 h of public IPv4, 5 GB S3 and 5 GB CloudWatch Logs. One instance running all month fits.
- **Account created on or after 15 July 2025 (free plan):** you get credits (USD 100, plus up to 100 more for onboarding tasks) for 6 months. This setup costs about USD 12–13/month, which the credits cover. A free-plan account can be pinned to a single region (ours: Asia Pacific (Sydney) ap-southeast-2). Use that region for everything; "Activate advanced features" unlocks other regions by upgrading to the paid plan, so don't click it. Without a paid plan nothing is ever billed; the account closes when the credits or the 6 months run out.
- **Avoid:** a second instance, a load balancer, a NAT gateway or an unattached Elastic IP. Each of these is billed.
- Set a budget alert first: **Billing → Budgets → Create budget → Zero spend budget**.

## 1. MongoDB Atlas (free M0)

1. In Atlas, create a separate project and an **M0** cluster with provider **AWS** in the **same region as EC2** (here Sydney, ap-southeast-2). A cluster in another region adds a long round trip to every query. Untick *Automate security setup*, since it creates an Atlas Admin user.
2. **Database Access:** create a user with *Read and write to any database*. It also needs index creation, because the API installs the `one_active_trip_per_captain` index at startup.
3. Copy the `mongodb+srv://…` string and add `/loadmitra` as the database name.
4. **Network Access:** add your EC2 Elastic IP after step 2 below. Don't use `0.0.0.0/0`.

## 2. EC2 instance (AWS Console, your account's region)

1. **EC2 → Key pairs → Create key pair** (`loadmitra`, `.pem`). Keep the downloaded file safe.
2. **EC2 → Launch instance:**
   - AMI: **Amazon Linux 2023**, arch **64-bit (Arm)**; instance type **t4g.micro** (1 GB, cheaper than t3.micro; the app is plain JavaScript, so Arm needs no changes)
   - Key pair: `loadmitra`
   - Security group: allow **SSH 22 from My IP**, **HTTP 80** and **HTTPS 443 from anywhere**
   - Storage: 12 GB gp3
3. **EC2 → Elastic IPs → Allocate**, then **Associate** it with the instance. This IP is your `EC2_IP`. Release it if you ever delete the instance, because an unattached Elastic IP is billed.

## 3. IAM role for CloudWatch and S3

1. **S3 → Create bucket:** `loadmitra-documents-<something-unique>`, same region. Leave **Block all public access ON** and default encryption (SSE-S3) on.
2. **IAM → Roles → Create role:** trusted entity *AWS service → EC2*. Attach **CloudWatchAgentServerPolicy**. Name it `loadmitra-ec2`.
3. On that role, **Add permissions → Create inline policy (JSON)**, replacing the bucket name:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::loadmitra-documents-REPLACE/*"
     }]
   }
   ```
4. **EC2 → your instance → Actions → Security → Modify IAM role** → `loadmitra-ec2`.

> The app has no document upload yet (captain KYC is still a placeholder). The bucket and permissions are ready for when that feature is built. Nothing needs keys, because the instance role supplies credentials.

## 4. Prepare the server (once)

From Git Bash in the repo root:

```bash
scp -i ~/.ssh/loadmitra.pem deploy/aws-ec2/setup-ec2.sh deploy/aws-ec2/set-db-password.sh ec2-user@EC2_IP:~
ssh -i ~/.ssh/loadmitra.pem ec2-user@EC2_IP 'bash setup-ec2.sh && mv set-db-password.sh /opt/loadmitra/ && chmod 700 /opt/loadmitra/set-db-password.sh'
```

Then create the API's environment file **on the instance** (`ssh` in, then `nano /opt/loadmitra/server/.env`):

```ini
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://loadmitra-api:__DB_PASSWORD__@CLUSTER.xxxx.mongodb.net/loadmitra?retryWrites=true&w=majority&appName=loadmitra
# Generate with: openssl rand -hex 32
JWT_SECRET=
CORS_ORIGIN=https://ship.EC2-IP-DASHED.sslip.io,https://captain.EC2-IP-DASHED.sslip.io
OTP_TTL_SECONDS=300
# nginx is one proxy hop in front of the API
TRUST_PROXY=1
# Demo login: the code is shown on screen (see the warning below)
OTP_DELIVERY=screen
```

Run `chmod 600 /opt/loadmitra/server/.env`. Then put the Atlas password in without it appearing on screen or in shell history. In PowerShell, start this first, then copy the password from Atlas and paste it at the prompt:

```bash
ssh -t -i ~/.ssh/loadmitra.pem ec2-user@EC2_IP /opt/loadmitra/set-db-password.sh
```

The helper URL-encodes the password into `MONGODB_URI`. Secrets live only on the instance and never in git.

## 5. Build and deploy

On your machine, from the repo root:

```bash
EC2_IP=13.233.10.20 ./deploy/aws-ec2/build.sh
EC2_IP=13.233.10.20 SSH_KEY=~/.ssh/loadmitra.pem CERTBOT_EMAIL=you@example.com ./deploy/aws-ec2/deploy.sh
```

`CERTBOT_EMAIL` is only needed the first time, to issue certificates; `CERTBOT_NO_EMAIL=1` issues them without registering an email (no expiry warnings; the cron job still renews). Later deploys are `build.sh` and `deploy.sh` without it. The deploy prints `/health`, the PM2 process list and the three URLs.

## 6. CloudWatch

- Logs appear under **CloudWatch → Log groups → `/loadmitra/api`, `/loadmitra/shipper`, `/loadmitra/captain`, `/loadmitra/nginx`** and are kept for 14 days.
- Metrics: **CloudWatch → Metrics → LoadMitra** shows memory, disk and swap every 5 minutes.
- Alarms (10 are free): create one on **EC2 → StatusCheckFailed ≥ 1** and one on **LoadMitra → mem_used_percent > 90**, each notifying an SNS email topic.

## ⚠️ Login is in demo mode

`OTP_DELIVERY=screen` shows the login code to whoever requests it. **Anyone can sign in as any phone number.** Use this deployment only for demos and testing with dummy data, never with real customers.

To go live, implement an SMS adapter and set `OTP_DELIVERY=sms`. Indian SMS delivery requires DLT registration, and none of the SMS options are free.

## Operations

| Task | Command (on the instance) |
|---|---|
| Status / restart | `pm2 ls`, `pm2 restart loadmitra-api` |
| Live logs | `pm2 logs loadmitra-api` |
| Edit config | `nano /opt/loadmitra/server/.env && pm2 restart loadmitra-api --update-env` |
| Certificates | `sudo certbot certificates` (auto-renew via cron) |
| Health | `curl -s localhost:4000/health`: `503` with `"db": "down"` means MongoDB is unreachable (check Atlas Network Access) |
| Log size | PM2 logs rotate at 10 MB, 7 kept (`pm2 conf pm2-logrotate`) |

Rate limits are held in memory, which is correct for this single instance. Running more than one API instance would need a shared store.
