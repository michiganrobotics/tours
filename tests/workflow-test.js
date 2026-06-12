#!/usr/bin/env node

/**
 * Comprehensive Tour Workflow Test Suite
 * 
 * Tests the complete tour system workflow:
 * 1. Public tour registration
 * 2. Special tour request 
 * 3. Dashboard operations (status changes, guide assignment)
 * 4. Email notifications at each step
 * 
 * Test Personas:
 * - Visitor: dan@dannewman.org
 * - Manager/Guide: dnewms@umich.edu
 */

const fetch = require('node-fetch');
const readline = require('readline');

// Configuration
const BASE_URL = process.env.TEST_BASE_URL || 'https://tours.robotics.umich.edu';
const API_URL = `${BASE_URL}/api`;

const TEST_DATA = {
  visitor: {
    name: 'Dan Newman',
    email: 'dan@dannewman.org',
    phone: '555-123-4567'
  },
  guide: {
    name: 'Test Guide',
    email: 'dnewms@umich.edu',
    phone: '555-987-6543'
  }
};

class WorkflowTester {
  constructor() {
    this.results = [];
    this.createdRecords = {
      tours: [],
      registrations: [],
      requests: [],
      guides: []
    };
  }

  async log(message, success = true) {
    const timestamp = new Date().toISOString();
    const status = success ? '✅' : '❌';
    const logMessage = `${timestamp} ${status} ${message}`;
    console.log(logMessage);
    this.results.push({ timestamp, success, message });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async makeRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testPublicTourRegistration() {
    await this.log('🚀 Starting Public Tour Registration Test');

    try {
      // First get available tours
      const toursResult = await this.makeRequest(`${API_URL}/public-tours`);
      if (!toursResult.success) {
        await this.log(`Failed to fetch tours: ${toursResult.error}`, false);
        return false;
      }

      const availableTours = toursResult.data.filter(tour => 
        tour.status === 'active' && new Date(tour.date) >= new Date()
      );

      if (availableTours.length === 0) {
        await this.log('No available tours found - creating test tour', false);
        return false;
      }

      const testTour = availableTours[0];
      await this.log(`Using tour: ${testTour.title} on ${testTour.date}`);

      // Register for the tour
      const registrationData = {
        public_tour_id: testTour.id,
        name: TEST_DATA.visitor.name,
        email: TEST_DATA.visitor.email,
        phone: TEST_DATA.visitor.phone,
        group_size: 2,
        notes: 'Automated test registration',
        tshirt_request: true,
        tshirt_sizes: { s: 1, m: 1 },
        tshirt_total: 2,
        tshirt_cost: 40,
        newsletter_signup: true
        // Note: reCAPTCHA token omitted for testing - validation is non-blocking
      };

      const registrationResult = await this.makeRequest(`${API_URL}/public-tour-registrations`, {
        method: 'POST',
        body: JSON.stringify(registrationData)
      });

      if (registrationResult.success) {
        await this.log('Public tour registration created successfully');
        this.createdRecords.registrations.push(registrationResult.data.id);
        await this.log('📧 Check dan@dannewman.org for confirmation email');
        return true;
      } else {
        await this.log(`Public tour registration failed: ${registrationResult.error}`, false);
        return false;
      }

    } catch (error) {
      await this.log(`Public tour registration test error: ${error.message}`, false);
      return false;
    }
  }

  async testSpecialTourRequest() {
    await this.log('🚀 Starting Special Tour Request Test');

    try {
      const requestData = {
        visitor_name: TEST_DATA.visitor.name,
        visitor_email: TEST_DATA.visitor.email,
        visitor_phone: TEST_DATA.visitor.phone,
        group_size: 5,
        preferred_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Next week
        preferred_time: '14:00',
        additional_info: 'Automated test special tour request - robotics research focus',
        tshirt_request: true,
        tshirt_sizes: { l: 2, xl: 3 },
        tshirt_total: 5,
        tshirt_cost: 100,
        newsletter_signup: true
        // Note: reCAPTCHA token omitted for testing - validation is non-blocking
      };

      const requestResult = await this.makeRequest(`${API_URL}/tour-requests`, {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      if (requestResult.success) {
        await this.log('Special tour request created successfully');
        this.createdRecords.requests.push(requestResult.data.id);
        await this.log('📧 Check dnewms@umich.edu for new tour request notification');
        return requestResult.data.id;
      } else {
        await this.log(`Special tour request failed: ${requestResult.error}`, false);
        return false;
      }

    } catch (error) {
      await this.log(`Special tour request test error: ${error.message}`, false);
      return false;
    }
  }

  async testTourStatusUpdate(requestId) {
    if (!requestId) {
      await this.log('Skipping status update - no request ID', false);
      return false;
    }

    await this.log('🚀 Starting Tour Status Update Test');

    try {
      // Update status to 'scheduled'
      const updateData = {
        id: requestId,
        status: 'scheduled'
      };

      await this.log(`Attempting to update request ${requestId} to scheduled status`);
      
      const updateResult = await this.makeRequest(`${API_URL}/tour-requests`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (updateResult.success) {
        await this.log('Tour status updated to scheduled');
        await this.log('✅ Status update completed (no email sent - emails sent when guide assigned)');
        return true;
      } else {
        await this.log(`Status update failed: ${updateResult.error}`, false);
        await this.log(`Request data sent: ${JSON.stringify(updateData)}`);
        
        // Try to get more details about the error
        if (updateResult.status) {
          await this.log(`HTTP Status: ${updateResult.status}`, false);
        }
        
        return false;
      }

    } catch (error) {
      await this.log(`Status update test error: ${error.message}`, false);
      return false;
    }
  }

  async testGuideAssignment(requestId) {
    if (!requestId) {
      await this.log('Skipping guide assignment - no request ID', false);
      return false;
    }

    await this.log('🚀 Starting Guide Assignment Test');

    try {
      // First get available guides
      const guidesResult = await this.makeRequest(`${API_URL}/tour-guides`);
      if (!guidesResult.success) {
        await this.log(`Failed to fetch guides: ${guidesResult.error}`, false);
        return false;
      }

      let testGuide = guidesResult.data.find(guide => 
        guide.email === TEST_DATA.guide.email
      );

      // Create test guide if it doesn't exist
      if (!testGuide) {
        await this.log('Creating test guide for assignment');
        const guideData = {
          name: TEST_DATA.guide.name,
          email: TEST_DATA.guide.email,
          phone: TEST_DATA.guide.phone,
          availability: 'Available for testing'
        };

        const createGuideResult = await this.makeRequest(`${API_URL}/tour-guides`, {
          method: 'POST',
          body: JSON.stringify(guideData)
        });

        if (createGuideResult.success) {
          testGuide = createGuideResult.data;
          this.createdRecords.guides.push(testGuide.id);
          await this.log('Test guide created successfully');
        } else {
          await this.log(`Failed to create test guide: ${createGuideResult.error}`, false);
          return false;
        }
      }

      // Assign guide to tour request
      const assignmentData = {
        id: requestId,
        assigned_guide_id: testGuide.id,
        status: 'confirmed'
      };

      const assignResult = await this.makeRequest(`${API_URL}/tour-requests`, {
        method: 'PUT',
        body: JSON.stringify(assignmentData)
      });

      if (assignResult.success) {
        await this.log(`Guide assigned successfully: ${testGuide.name}`);
        await this.log('📧 Check dnewms@umich.edu for guide assignment email');
        await this.log('📧 Check dan@dannewman.org for tour confirmation email');
        return true;
      } else {
        await this.log(`Guide assignment failed: ${assignResult.error}`, false);
        return false;
      }

    } catch (error) {
      await this.log(`Guide assignment test error: ${error.message}`, false);
      return false;
    }
  }

  async promptForContinue(message) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`${message} (Press Enter to continue, 'q' to quit): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() !== 'q');
      });
    });
  }

  async runAllTests() {
    console.log('🎯 Tour Workflow Test Suite Starting...\n');
    console.log(`Testing against: ${BASE_URL}`);
    console.log(`Visitor email: ${TEST_DATA.visitor.email}`);
    console.log(`Guide email: ${TEST_DATA.guide.email}\n`);

    const shouldContinue = await this.promptForContinue('Ready to start tests?');
    if (!shouldContinue) {
      console.log('Tests cancelled by user');
      return;
    }

    let allPassed = true;

    // Test 1: Public Tour Registration
    const publicTourSuccess = await this.testPublicTourRegistration();
    allPassed = allPassed && publicTourSuccess;

    await this.sleep(2000); // Wait between tests

    // Test 2: Special Tour Request
    const requestId = await this.testSpecialTourRequest();
    allPassed = allPassed && !!requestId;

    await this.sleep(2000);

    // Test 3: Status Update
    const statusUpdateSuccess = await this.testTourStatusUpdate(requestId);
    allPassed = allPassed && statusUpdateSuccess;

    await this.sleep(2000);

    // Test 4: Guide Assignment
    const guideAssignSuccess = await this.testGuideAssignment(requestId);
    allPassed = allPassed && guideAssignSuccess;

    console.log('\n📅 Note about Reminder Emails:');
    console.log('Reminder emails are sent automatically by the system the day before tours.');
    console.log('These are not tested directly but will be sent for any tours scheduled tomorrow.');
    console.log('Check the send-reminder-emails function logs for reminder email activity.');

    // Summary
    console.log('\n📊 Test Summary:');
    console.log('================');
    
    const successCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;
    
    console.log(`Total Tests: ${totalCount}`);
    console.log(`Passed: ${successCount}`);
    console.log(`Failed: ${totalCount - successCount}`);
    console.log(`Success Rate: ${((successCount / totalCount) * 100).toFixed(1)}%`);

    if (allPassed) {
      console.log('\n🎉 All workflow tests completed successfully!');
      console.log('\n📧 Complete Email Workflow:');
      console.log('- dan@dannewman.org (visitor) should receive:');
      console.log('  • Public tour registration confirmation');
      console.log('  • Special tour request confirmation');  
      console.log('  • Tour confirmation with guide details');
      console.log('  • Reminder email (day before tour)');
      console.log('- dnewms@umich.edu (manager/guide) should receive:');
      console.log('  • New special tour request notification');
      console.log('  • Guide assignment notification');
      console.log('  • Guide reminder email (day before tour)');
      console.log('\n📅 Additional Email Features:');
      console.log('- Reminder emails are sent automatically day before tours');
      console.log('- Public tour reminders include parking and arrival info');
      console.log('- Guide reminders include visitor details and checklist');
    } else {
      console.log('\n❌ Some tests failed. Check the logs above for details.');
    }

    // Cleanup prompt
    const shouldCleanup = await this.promptForContinue('\nCleanup test data?');
    if (shouldCleanup) {
      await this.cleanup();
    }
  }

  async cleanup() {
    await this.log('🧹 Starting cleanup of test data...');
    
    // Note: Add cleanup API calls here if needed
    // For now, just log what was created
    
    if (this.createdRecords.registrations.length > 0) {
      await this.log(`Created registrations (manual cleanup may be needed): ${this.createdRecords.registrations.join(', ')}`);
    }
    
    if (this.createdRecords.requests.length > 0) {
      await this.log(`Created requests (manual cleanup may be needed): ${this.createdRecords.requests.join(', ')}`);
    }
    
    if (this.createdRecords.guides.length > 0) {
      await this.log(`Created guides (manual cleanup may be needed): ${this.createdRecords.guides.join(', ')}`);
    }

    await this.log('Cleanup completed');
  }
}

// Run the tests
if (require.main === module) {
  const tester = new WorkflowTester();
  tester.runAllTests().catch(console.error);
}

module.exports = WorkflowTester;