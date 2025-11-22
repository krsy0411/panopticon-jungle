"""
Locust Performance Test for Producer Server - Traces

Goal: Send 1,000,000+ trace spans (in chains of 3 spans each)

Usage:
    # Recommended: Use the provided shell script
    ./scripts/run-locust-traces.sh

    # Or run directly (1M+ spans with 10 users)
    locust -f scripts/locustfile_traces.py --host https://api.jungle-panopticon.cloud/producer \
           --users 10 --spawn-rate 10 --headless

Environment Variables:
    PRODUCER_URL: Override target server URL (default: https://api.jungle-panopticon.cloud/producer)
"""

import random
import os
from datetime import datetime, timezone, timedelta
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner


# Configuration
PRODUCER_URL = os.getenv('PRODUCER_URL', 'https://api.jungle-panopticon.cloud/producer')

# Each request sends 20 spans (multiple trace chains)
# Target: 1,000,000 spans = 50,000 requests (each with 20 spans)
# Goal: 50,000 spans/sec → 20 seconds for 1M spans
SPANS_PER_REQUEST = 20
TARGET_REQUESTS = 50000  # 50,000 requests × 20 spans = 1,000,000 spans
current_request_count = 0


def generate_trace_id():
    """Generate a random 32-character hex trace ID"""
    return ''.join(random.choices('0123456789abcdef', k=32))


def generate_span_id():
    """Generate a random 16-character hex span ID"""
    return ''.join(random.choices('0123456789abcdef', k=16))


def generate_single_trace_chain():
    """
    Generate a single chain of 3 connected spans sharing the same trace_id.

    Structure:
    - Root span (parent_span_id: null)
      - Child span 1 (parent_span_id: root)
        - Child span 2 (parent_span_id: child1)

    All spans:
    - kind: SERVER
    - duration_ms: random 0-1000ms
    - status: OK or ERROR
    - service_name: same for all spans in a trace
    - trace_id: unified across all 3 spans
    """
    # Shared trace ID for all spans
    trace_id = generate_trace_id()

    # Generate span IDs
    root_span_id = generate_span_id()
    child1_span_id = generate_span_id()
    child2_span_id = generate_span_id()

    # Shared service name for this trace
    service_name = "backend-service"

    # Base timestamp
    base_time = datetime.now(timezone.utc) - timedelta(milliseconds=random.randint(0, 1000))

    spans = []

    # Root Span
    root_duration = random.uniform(0, 1000)
    root_status = random.choice(['OK', 'ERROR'])

    root_span = {
        'type': 'span',
        'timestamp': base_time.isoformat(),
        'service_name': service_name,
        'environment': 'production',
        'trace_id': trace_id,
        'span_id': root_span_id,
        'parent_span_id': None,
        'name': f'GET /api/endpoint-{random.randint(1, 100)}',
        'kind': 'SERVER',
        'duration_ms': round(root_duration, 2),
        'status': root_status,
        'http_method': 'GET',
        'http_path': f'/api/endpoint-{random.randint(1, 100)}',
        'http_status_code': 200 if root_status == 'OK' else 500,
        'labels': {
            'component': 'api'
        }
    }
    spans.append(root_span)

    # Child Span 1
    child1_start = base_time + timedelta(milliseconds=random.uniform(1, 10))
    child1_duration = random.uniform(0, min(root_duration * 0.8, 1000))
    child1_status = random.choice(['OK', 'ERROR'])

    child1_span = {
        'type': 'span',
        'timestamp': child1_start.isoformat(),
        'service_name': service_name,
        'environment': 'production',
        'trace_id': trace_id,
        'span_id': child1_span_id,
        'parent_span_id': root_span_id,
        'name': f'process-request-{random.randint(1, 50)}',
        'kind': 'SERVER',
        'duration_ms': round(child1_duration, 2),
        'status': child1_status,
        'http_method': 'POST',
        'http_path': f'/internal/process-{random.randint(1, 50)}',
        'http_status_code': 200 if child1_status == 'OK' else 500,
        'labels': {
            'component': 'processor'
        }
    }
    spans.append(child1_span)

    # Child Span 2 (grandchild of root)
    child2_start = child1_start + timedelta(milliseconds=random.uniform(1, 5))
    child2_duration = random.uniform(0, min(child1_duration * 0.6, 1000))
    child2_status = random.choice(['OK', 'ERROR'])

    child2_span = {
        'type': 'span',
        'timestamp': child2_start.isoformat(),
        'service_name': service_name,
        'environment': 'production',
        'trace_id': trace_id,
        'span_id': child2_span_id,
        'parent_span_id': child1_span_id,
        'name': f'database-query-{random.randint(1, 20)}',
        'kind': 'SERVER',
        'duration_ms': round(child2_duration, 2),
        'status': child2_status,
        'http_method': 'GET',
        'http_path': f'/db/query-{random.randint(1, 20)}',
        'http_status_code': 200 if child2_status == 'OK' else 500,
        'labels': {
            'component': 'database'
        }
    }
    spans.append(child2_span)

    return spans


def generate_batch_spans():
    """
    Generate a batch of 20 spans (6-7 trace chains).

    Returns a flat list of 20 spans from multiple independent traces.
    Each trace maintains its own trace_id and parent-child relationships.
    """
    all_spans = []

    # Generate 6 complete trace chains (6 × 3 = 18 spans)
    for _ in range(6):
        trace_chain = generate_single_trace_chain()
        all_spans.extend(trace_chain)

    # Generate 2 more spans from a partial trace chain (to reach 20 total)
    partial_trace = generate_single_trace_chain()
    all_spans.extend(partial_trace[:2])  # Take only first 2 spans

    return all_spans


class TracesLoadTest(HttpUser):
    """
    Sends batches of trace spans to the producer server continuously.

    Goal: Send 1,000,000 spans (50,000 requests × 20 spans each)
    Target: 50,000 spans/sec → ~20 seconds for 1M spans
    Will stop automatically when target is reached.
    """

    # No wait time between requests for maximum throughput
    wait_time = lambda self: 0

    # Override host with environment variable or default
    host = PRODUCER_URL

    @task
    def send_batch_spans(self):
        """Send a batch of 20 spans (multiple trace chains) to /dummy/traces endpoint"""
        global current_request_count

        # Check if we've reached the target requests
        if current_request_count >= TARGET_REQUESTS:
            self.environment.runner.quit()
            return

        # Generate a batch of 20 spans from multiple trace chains
        batch_spans = generate_batch_spans()

        with self.client.post(
            '/dummy/traces',
            json=batch_spans,
            catch_response=True,
            name=f'POST /dummy/traces (batch of {SPANS_PER_REQUEST})'
        ) as response:
            if response.status_code == 202:
                current_request_count += 1
                response.success()
            else:
                response.failure(f'Expected 202, got {response.status_code}')


# Event handlers for test lifecycle
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Print test configuration when test starts"""
    if not isinstance(environment.runner, MasterRunner):
        global current_request_count
        current_request_count = 0

        total_spans = TARGET_REQUESTS * SPANS_PER_REQUEST
        print("\n" + "="*80)
        print("🚀 Locust Traces Load Test Starting")
        print("="*80)
        print(f"Target Server: {PRODUCER_URL}")
        print(f"Test Endpoint: POST /dummy/traces")
        print(f"Spans per Request: {SPANS_PER_REQUEST} (batch of ~6-7 trace chains)")
        print(f"Target Requests: {TARGET_REQUESTS:,}")
        print(f"Total Spans: ~{total_spans:,} spans")
        print(f"Goal: 50,000 spans/sec → ~20 seconds for 1M spans")
        print(f"\nTrace Structure:")
        print(f"  - Each batch contains 6-7 independent trace chains")
        print(f"  - Each trace chain: Root → Child1 → Child2 (3 spans)")
        print(f"  - All spans in a trace share same trace_id")
        print(f"\nSpan Properties:")
        print(f"  - kind: SERVER (all spans)")
        print(f"  - duration_ms: 0-1000 (random)")
        print(f"  - status: OK or ERROR (random)")
        print(f"  - service_name: backend-service (unified)")
        print(f"\nTest will automatically stop when target is reached.")
        print("="*80 + "\n")


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, context, **kwargs):
    """Track progress every 5,000 requests"""
    global current_request_count

    if current_request_count % 5000 == 0 and current_request_count > 0:
        total_spans = current_request_count * SPANS_PER_REQUEST
        target_spans = TARGET_REQUESTS * SPANS_PER_REQUEST
        progress = (current_request_count / TARGET_REQUESTS * 100)
        print(f"Progress: {current_request_count:,} requests ({total_spans:,} spans / ~{target_spans:,}) - {progress:.1f}%")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Print summary when test stops"""
    if not isinstance(environment.runner, MasterRunner):
        stats = environment.stats.total
        total_requests = stats.num_requests
        total_spans = current_request_count * SPANS_PER_REQUEST

        print("\n" + "="*80)
        print("✅ Locust Traces Load Test Completed")
        print("="*80)
        print(f"Total Trace Requests Sent: {current_request_count:,}")
        print(f"Total Spans Sent: ~{total_spans:,}")
        print(f"Total HTTP Requests: {total_requests:,}")
        print(f"\nTotal Failures: {stats.num_failures:,}")
        print(f"Average Response Time: {stats.avg_response_time:.2f}ms")
        if stats.total_rps > 0:
            actual_spans_per_sec = stats.total_rps * SPANS_PER_REQUEST
            print(f"Requests/sec: {stats.total_rps:.2f} (≈ {actual_spans_per_sec:,.0f} spans/sec)")
        print("\nDetailed metrics available in:")
        print("  - Locust web UI: http://localhost:8089")
        print("  - HTML report (if --html flag was used)")
        print("="*80 + "\n")
