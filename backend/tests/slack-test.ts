// @ts-nocheck
/**
 * Quick Slack Connection Test
 * Run with: node tests/slack-test.js
 */

require('dotenv').config();
const { WebClient } = require('@slack/web-api');

async function testSlackConnection() {
  console.log('🔍 Testing Slack Connection...\n');

  // Check environment variables
  console.log('Environment Variables:');
  console.log('  SLACK_ENABLED:', process.env.SLACK_ENABLED);
  console.log('  SLACK_BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? '✅ Set (starts with ' + process.env.SLACK_BOT_TOKEN.substring(0, 10) + '...)' : '❌ Not set');
  console.log('  SLACK_SIGNING_SECRET:', process.env.SLACK_SIGNING_SECRET ? '✅ Set' : '❌ Not set');
  console.log('  SLACK_APPROVAL_CHANNEL:', process.env.SLACK_APPROVAL_CHANNEL || '❌ Not set');
  console.log('');

  if (!process.env.SLACK_BOT_TOKEN) {
    console.log('❌ SLACK_BOT_TOKEN is not set. Cannot test connection.');
    return;
  }

  const client = new WebClient(process.env.SLACK_BOT_TOKEN);

  try {
    // Test 1: Auth test
    console.log('1️⃣ Testing authentication...');
    const authResult = await client.auth.test();
    console.log('   ✅ Auth successful!');
    console.log('   Team:', authResult.team);
    console.log('   Bot User:', authResult.user);
    console.log('   Bot ID:', authResult.user_id);
    console.log('');

    // Test 2: Send a test message to the approval channel
    const channel = process.env.SLACK_APPROVAL_CHANNEL || '#db-approvals';
    console.log(`2️⃣ Sending test message to ${channel}...`);
    
    const messageResult = await client.chat.postMessage({
      channel: channel,
      text: '🧪 Test message from DB Query Portal - Slack integration is working!',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🧪 Slack Integration Test',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Status:* ✅ Connection successful!\n*Time:* ' + new Date().toISOString(),
          },
        },
      ],
    });

    if (messageResult.ok) {
      console.log('   ✅ Message sent successfully!');
      console.log('   Channel:', messageResult.channel);
      console.log('   Timestamp:', messageResult.ts);
    }
    console.log('');

    console.log('🎉 All tests passed! Slack integration is working properly.');

  } catch (error) {
    console.log('❌ Error:', error.message);
    
    if (error.data?.error === 'channel_not_found') {
      console.log('\n💡 Tip: Make sure the bot is invited to the channel.');
      console.log('   In Slack, go to the channel and type: /invite @DB Query Portal');
    } else if (error.data?.error === 'not_in_channel') {
      console.log('\n💡 Tip: The bot needs to be added to the channel.');
      console.log('   In Slack, go to the channel and type: /invite @DB Query Portal');
    } else if (error.data?.error === 'invalid_auth') {
      console.log('\n💡 Tip: The bot token appears to be invalid.');
      console.log('   Check that SLACK_BOT_TOKEN starts with "xoxb-"');
    }
  }
}

testSlackConnection();
