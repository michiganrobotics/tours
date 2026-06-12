# Tour Workflow Test Suite

Automated end-to-end testing for the complete tour management workflow.

## What It Tests

### 🎯 Complete User Journey
1. **Public Tour Registration** - Visitor registers for an available public tour
2. **Special Tour Request** - Visitor requests a custom tour
3. **Tour Status Updates** - Admin changes request status to "scheduled"
4. **Guide Assignment** - Admin assigns a guide and confirms the tour

### 📧 Email Notifications
Tests that all email notifications are sent correctly:
- **dan@dannewman.org** (visitor) receives:
  - Public tour registration confirmation
  - Special tour scheduling confirmation  
  - Tour confirmation with guide details
  - Reminder email (automatically sent day before tour)
- **dnewms@umich.edu** (guide/manager) receives:
  - New special tour request notification
  - Guide assignment notification
  - Guide reminder email (automatically sent day before tour)

### 🔄 Data Flow
- Creates test data in the system
- Verifies API responses
- Tracks created records for cleanup
- Tests the complete workflow from visitor request to confirmed tour

## Usage

### Install Dependencies
```bash
npm install
```

### Run Tests

**Against Production:**
```bash
npm run test:workflow:prod
```

**Against Local Development:**
```bash
npm run test:workflow:local
```

**Against Default (production):**
```bash
npm run test:workflow
```

## Test Personas

The test uses these consistent email addresses:

- **Visitor/Requester**: `dan@dannewman.org`
- **Guide/Manager**: `dnewms@umich.edu`

## What to Expect

### Test Output
```
🎯 Tour Workflow Test Suite Starting...

Testing against: https://tours.robotics.umich.edu
Visitor email: dan@dannewman.org
Guide email: dnewms@umich.edu

Ready to start tests? (Press Enter to continue, 'q' to quit): 

2024-06-18T15:30:00.000Z ✅ 🚀 Starting Public Tour Registration Test
2024-06-18T15:30:01.234Z ✅ Using tour: Friday Public Tour on 2024-06-21
2024-06-18T15:30:02.567Z ✅ Public tour registration created successfully
2024-06-18T15:30:02.568Z ✅ 📧 Check dan@dannewman.org for confirmation email

2024-06-18T15:30:04.789Z ✅ 🚀 Starting Special Tour Request Test
2024-06-18T15:30:05.012Z ✅ Special tour request created successfully
2024-06-18T15:30:05.013Z ✅ 📧 Check admin notifications for new tour request

2024-06-18T15:30:07.234Z ✅ 🚀 Starting Tour Status Update Test
2024-06-18T15:30:07.456Z ✅ Tour status updated to scheduled
2024-06-18T15:30:07.457Z ✅ 📧 Check dan@dannewman.org for scheduling confirmation email

2024-06-18T15:30:09.678Z ✅ 🚀 Starting Guide Assignment Test
2024-06-18T15:30:09.890Z ✅ Test guide created successfully
2024-06-18T15:30:10.123Z ✅ Guide assigned successfully: Test Guide
2024-06-18T15:30:10.124Z ✅ 📧 Check dnewms@umich.edu for guide assignment email
2024-06-18T15:30:10.125Z ✅ 📧 Check dan@dannewman.org for tour confirmation email

📊 Test Summary:
================
Total Tests: 12
Passed: 12
Failed: 0
Success Rate: 100.0%

🎉 All workflow tests completed successfully!

📧 Complete Email Workflow:
- dan@dannewman.org (visitor) should receive:
  • Public tour registration confirmation
  • Special tour request confirmation
  • Tour confirmation with guide details
  • Reminder email (day before tour)
- dnewms@umich.edu (manager/guide) should receive:
  • New special tour request notification
  • Guide assignment notification
  • Guide reminder email (day before tour)

📅 Additional Email Features:
- Reminder emails are sent automatically day before tours
- Public tour reminders include parking and arrival info
- Guide reminders include visitor details and checklist

Cleanup test data? (Press Enter to continue, 'q' to quit): 
```

### Email Verification
After running the tests, check both email addresses:

**Immediate emails (from test run):**
1. **dan@dannewman.org** should receive 3 emails
2. **dnewms@umich.edu** should receive 2 emails

**Automatic reminder emails (sent day before tours):**
3. **dan@dannewman.org** will receive reminder emails day before scheduled tours
4. **dnewms@umich.edu** will receive guide reminder emails day before assigned tours

**Total possible emails per complete workflow:** Up to 6 emails (3 to visitor, 3 to guide/manager)

## Test Data

The test creates realistic data:
- **Group sizes**: 2-5 people
- **T-shirt orders**: Mix of sizes with proper totals
- **Dates**: Future dates (next week)
- **Notes**: Clearly marked as automated tests

## Cleanup

The script will prompt you to cleanup test data at the end. This helps keep the system clean after testing.

## Troubleshooting

### Common Issues

**No available tours:**
```
❌ No available tours found - creating test tour
```
*Solution: Create an active public tour with a future date*

**reCAPTCHA failures:**
```
❌ reCAPTCHA validation failed
```
*Solution: The test uses a dummy token - this might fail if strict validation is enabled*

**Email not sent:**
```
❌ Email not sent - missing tour or email
```
*Solution: Check that Mailgun environment variables are configured*

### Debugging

Add console logging to see detailed API responses:
```bash
DEBUG=true npm run test:workflow
```

## Integration with CI/CD

You can integrate this into your deployment pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Workflow Tests
  run: npm run test:workflow:prod
  env:
    TEST_TIMEOUT: 30000
```

## Contributing

To add new test scenarios:
1. Add new test methods to the `WorkflowTester` class
2. Call them in `runAllTests()`
3. Update this README with the new test coverage