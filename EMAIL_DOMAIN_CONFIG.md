# Email Domain Validation Configuration

## Overview

The application now validates that only company email addresses are accepted for customer registrations. Public email providers (Gmail, Yahoo, Outlook, etc.) are automatically rejected.

## Configuration

### Allowed Email Domains

The list of allowed email domains is configured in:

**Backend:** `backend/src/utils/email-domain.validator.ts`
**Frontend:** `frontend/src/utils/emailValidation.ts`

### Current Allowed Domains

- `rtlgds.com`
- `sumedha-it.com`

### Adding New Allowed Domains

To add a new company domain, update both files:

1. **Backend** (`backend/src/utils/email-domain.validator.ts`):
   ```typescript
   const ALLOWED_EMAIL_DOMAINS = [
     'rtlgds.com',
     'sumedha-it.com',
     'your-new-domain.com', // Add here
   ];
   ```

2. **Frontend** (`frontend/src/utils/emailValidation.ts`):
   ```typescript
   const ALLOWED_EMAIL_DOMAINS = [
     'rtlgds.com',
     'sumedha-it.com',
     'your-new-domain.com', // Add here
   ];
   ```

**Important:** Keep both lists synchronized!

## How It Works

### Backend Validation (Mandatory)

- Validates email domain when creating a lead
- Throws `BadRequestException` if domain is not allowed
- Error message: "Only company email addresses are allowed. Please use your company email address."

### Frontend Validation (UX Only)

- Real-time validation as user types
- Shows error message: "Please use your company email address"
- Does NOT block submission - backend is the source of truth

### Blocked Public Domains

The following public email providers are automatically blocked:
- Gmail
- Yahoo
- Outlook
- Hotmail
- AOL
- iCloud
- Mail.com
- ProtonMail
- Yandex
- Zoho
- GMX
- Live.com
- MSN
- Rediffmail
- Inbox.com

## Auto-Fill Functionality

### How It Works

1. **First Visit:**
   - Customer enters information
   - Data is saved to database and localStorage

2. **Return Visit:**
   - System checks localStorage first (instant)
   - If not found, checks backend by email
   - Auto-fills all form fields

### Data Stored

- Customer name
- Email address (validated company email)
- Phone number (optional)
- Company name (optional)

### Storage Locations

- **Database:** `leads` table (persistent, cross-device)
- **localStorage:** Browser storage (instant, device-specific)

## API Endpoints

### Create Lead (with validation)
```
POST /leads
Body: { name, email, phone?, company? }
```

### Get Lead by Email (for auto-fill)
```
GET /leads?email=user@company.com
```

## Database Schema

The `leads` table structure:
```sql
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    company VARCHAR(150),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Testing

### Test Allowed Domain
```
Email: user@rtlgds.com ✅ Allowed
Email: user@sumedha-it.com ✅ Allowed
```

### Test Blocked Domain
```
Email: user@gmail.com ❌ Blocked
Email: user@yahoo.com ❌ Blocked
Email: user@outlook.com ❌ Blocked
```

### Test Unknown Domain
```
Email: user@unknown.com ❌ Blocked (not in allowed list)
```

## Troubleshooting

### Email Not Accepted

1. Check if domain is in `ALLOWED_EMAIL_DOMAINS` list
2. Ensure domain is added to both backend and frontend files
3. Restart backend server after changes
4. Clear browser cache if frontend validation not working

### Auto-Fill Not Working

1. Check browser localStorage (DevTools → Application → Local Storage)
2. Verify email was saved in database
3. Check browser console for errors
4. Ensure API endpoint `/leads?email=...` is accessible

## Security Notes

- Email validation is enforced on the backend (mandatory)
- Frontend validation is for UX only
- Never trust frontend validation alone
- Always validate on backend before saving to database

