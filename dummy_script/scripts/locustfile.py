"""
Locust Performance Test for Producer Server

Goal: Send exactly 1,000,000 logs with max 10 concurrent users
      (No time limit - will run until 1M logs are sent)

Usage:
    # Recommended: Use the provided shell script
    ./scripts/run-locust.sh

    # Or run directly (1M logs with 10 users)
    locust -f scripts/locustfile.py --host https://api.jungle-panopticon.cloud/producer \
           --users 10 --spawn-rate 10 --headless

Environment Variables:
    PRODUCER_URL: Override target server URL (default: https://api.jungle-panopticon.cloud/producer)
"""

import random
import os
from datetime import datetime, timezone
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner, WorkerRunner


# Configuration
PRODUCER_URL = os.getenv('PRODUCER_URL', 'https://api.jungle-panopticon.cloud/producer')

# Target: ~1,000,000 logs (sent in batches of 15)
BATCH_SIZE = 100
TARGET_BATCHES = 10000  # 66,667 batches × 15 = 1,000,005 logs
current_batch_count = 0


def generate_trace_id():
    """Generate a random 32-character hex trace ID"""
    return ''.join(random.choices('0123456789abcdef', k=32))


def generate_span_id():
    """Generate a random 16-character hex span ID"""
    return ''.join(random.choices('0123456789abcdef', k=16))


def generate_log_data():
    """Generate a simple log entry matching the producer's expected format"""
    return {
        'type': 'log',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'service_name': 'sample-service',
        'environment': 'prod',
        'level': 'INFO',
        'message': '샘플 APM 로그 이벤트',
        'trace_id': generate_trace_id(),
        'span_id': generate_span_id(),
        'http_method': 'GET',
        'http_path': '/api/sample',
        'http_status_code': 200,
        'labels': {
            'feature': 'sample',
            'host': 'local',
        }
    }


class ProducerLoadTest(HttpUser):
    """
    Sends logs to the producer server continuously.

    Goal: Send exactly 1,000,000 logs with 10 concurrent users.
    Will stop automatically when target is reached.
    """

    # Small wait time between requests (adjust based on network performance)
    # wait_time = between(0, 0.01)
    wait_time = lambda self: 0

    # Override host with environment variable or default
    host = PRODUCER_URL

    @task
    def send_batch_logs(self):
        """Send a batch of 15 logs to /dummy/logs endpoint"""
        global current_batch_count

        # Check if we've reached the target batches
        if current_batch_count >= TARGET_BATCHES:
            self.environment.runner.quit()
            return

        # Generate batch of 15 logs
        batch_data = [generate_log_data() for _ in range(BATCH_SIZE)]

        with self.client.post(
            '/dummy/logs',
            json=batch_data,
            catch_response=True,
            name=f'POST /dummy/logs (batch of {BATCH_SIZE})'
        ) as response:
            if response.status_code == 202:
                current_batch_count += 1
                response.success()
            else:
                response.failure(f'Expected 202, got {response.status_code}')


# Event handlers for test lifecycle
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Print test configuration when test starts"""
    if not isinstance(environment.runner, MasterRunner):
        global current_batch_count
        current_batch_count = 0

        total_logs = TARGET_BATCHES * BATCH_SIZE
        print("\n" + "="*80)
        print("🚀 Locust Load Test Starting")
        print("="*80)
        print(f"Target Server: {PRODUCER_URL}")
        print(f"Test Endpoint: POST /dummy/logs")
        print(f"Batch Size: {BATCH_SIZE} logs per request")
        print(f"Target Batches: {TARGET_BATCHES:,}")
        print(f"Total Logs: ~{total_logs:,} logs")
        print(f"Payload: Simple fixed format (trace_id/span_id randomized)")
        print(f"\nTest will automatically stop when target is reached.")
        print("="*80 + "\n")


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, context, **kwargs):
    """Track progress every 3,000 batches"""
    global current_batch_count

    if current_batch_count % 3000 == 0 and current_batch_count > 0:
        total_logs = current_batch_count * BATCH_SIZE
        target_logs = TARGET_BATCHES * BATCH_SIZE
        progress = (current_batch_count / TARGET_BATCHES * 100)
        print(f"Progress: {current_batch_count:,} batches ({total_logs:,} logs / ~{target_logs:,}) - {progress:.1f}%")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Print summary when test stops"""
    if not isinstance(environment.runner, MasterRunner):
        stats = environment.stats.total
        total_requests = stats.num_requests
        total_logs = current_batch_count * BATCH_SIZE

        print("\n" + "="*80)
        print("✅ Locust Load Test Completed")
        print("="*80)
        print(f"Total Batches Sent: {current_batch_count:,}")
        print(f"Total Logs Sent: ~{total_logs:,}")
        print(f"Total HTTP Requests: {total_requests:,}")
        print(f"\nTotal Failures: {stats.num_failures:,}")
        print(f"Average Response Time: {stats.avg_response_time:.2f}ms")
        print("\nDetailed metrics available in:")
        print("  - Locust web UI: http://localhost:8089")
        print("  - HTML report (if --html flag was used)")
        print("="*80 + "\n")
