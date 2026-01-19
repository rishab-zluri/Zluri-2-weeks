# Manual Setup Commands - Copy & Paste

Since I can't interact with your browser for Railway authentication, here are the exact commands you need to run in your terminal.

## Step 1: Login to Railway

Open your terminal and run:

```bash
railway login
```

This will open your browser. Click "Authorize" and return to terminal.

---

## Step 2: Link Your Project

```bash
cd backend
railway link
```

Select your backend project from the list.

---

## Step 3: Build the Project

```bash
npm run build
```

---

## Step 4: Run Migrations

```bash
railway run npm run orm:migration:up
```

This creates all database tables.

---

## Step 5: Create Admin User

```bash
railway run node -e "
const { MikroORM } = require('@mikro-orm/core');
const config = require('./dist/mikro-orm.config').default;
const bcrypt = require('bcryptjs');

(async () => {
  const orm = await MikroORM.init(config);
  const em = orm.em.fork();
  const User = require('./dist/entities/User').User;
  
  const admin = em.create(User, {
    email: 'admin@yourdomain.com',
    passwordHash: await bcrypt.hash('Admin123!', 12),
    name: 'Admin User',
    role: 'admin',
    isActive: true
  });
  
  await em.persistAndFlush(admin);
  console.log('✅ Admin user created!');
  console.log('Email: admin@yourdomain.com');
  console.log('Password: Admin123!');
  await orm.close();
})();
"
```

---

## Step 6: Verify

```bash
railway run psql $DATABASE_URL -c "SELECT email, role FROM users;"
```

---

## Step 7: Test Login

Visit your frontend and login with:
- Email: `admin@yourdomain.com`
- Password: `Admin123!`

---

## Done! ✅

Your Railway database is now set up and ready to use.
