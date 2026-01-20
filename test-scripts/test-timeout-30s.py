"""
Test Script: 30 Second Timeout Test (Python)

PURPOSE: Verify that Python scripts timeout after 30 seconds
EXPECTED: Script should be killed after 30 seconds

HOW TO USE:
1. Upload this script via the portal
2. Submit for approval
3. After approval, script should timeout with error
"""

import time
from datetime import datetime

print(f'Script started at: {datetime.now().isoformat()}')
print('This script will run for 35 seconds to test timeout...')

start_time = time.time()
target_duration = 35  # 35 seconds (exceeds 30s timeout)

# Busy wait loop
last_log = 0
while time.time() - start_time < target_duration:
    elapsed = int(time.time() - start_time)
    
    # Log every 5 seconds
    if elapsed % 5 == 0 and elapsed > 0 and elapsed != last_log:
        print(f'Still running... {elapsed} seconds elapsed')
        last_log = elapsed
    
    time.sleep(0.1)  # Small sleep to prevent 100% CPU

# This should never be reached due to timeout
print(f'Script completed at: {datetime.now().isoformat()}')
print('If you see this message, the timeout did NOT work!')
