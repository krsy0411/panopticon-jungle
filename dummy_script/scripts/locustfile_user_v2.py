"""
Locust User Simulation Test for Producer Server

Goal: Send realistic logs and spans over several hours with 1% error rate

Usage:
    # Run with custom duration (e.g., 3 hours)
    locust -f scripts/locustfile_user.py --host https://api.jungle-panopticon.cloud/producer \
           --users 5 --spawn-rate 1 --run-time 3h --headless

    # Run with web UI
    locust -f scripts/locustfile_user.py --host https://api.jungle-panopticon.cloud/producer

Environment Variables:
    PRODUCER_URL: Override target server URL (default: https://api.jungle-panopticon.cloud/producer)
"""

import random
from datetime import datetime, timezone, timedelta
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner


# Configuration
PRODUCER_URL = 'https://api.jungle-panopticon.cloud/producer'
ERROR_RATE = 0.02  # 2% error rate

# Sample data pools for realistic log generation
# Each service has its own relevant endpoints
SERVICE_ENDPOINTS = {
    'ecommerce-backend': {
        'GET': ['/products', '/products/{id}', '/categories', '/health', '/api/items'],
        'POST': ['/products', '/api/cart', '/api/checkout'],
        'PUT': ['/products/{id}', '/api/cart/{id}'],
        'DELETE': ['/products/{id}', '/api/cart/{id}']
    },
    'week14-board-backend': {
        'GET': ['/posts', '/posts/{id}', '/comments', '/health'],
        'POST': ['/posts', '/comments', '/auth/login', '/auth/register'],
        'PUT': ['/posts/{id}', '/comments/{id}'],
        'DELETE': ['/posts/{id}', '/comments/{id}']
    },
    'user-service': {
        'GET': ['/users', '/users/{id}', '/users/profile', '/health'],
        'POST': ['/auth/login', '/auth/register', '/users'],
        'PUT': ['/users/{id}', '/users/profile', '/users/settings'],
        'DELETE': ['/users/{id}']
    },
    'payment-service': {
        'GET': ['/payments', '/payments/{id}', '/transactions', '/health'],
        'POST': ['/payments', '/payments/process', '/refunds'],
        'PUT': ['/payments/{id}'],
        'DELETE': ['/payments/{id}']
    },
    'notification-service': {
        'GET': ['/notifications', '/notifications/{id}', '/health'],
        'POST': ['/notifications', '/notifications/send'],
        'PUT': ['/notifications/{id}/read'],
        'DELETE': ['/notifications/{id}']
    },
    'order-service': {
        'GET': ['/orders', '/orders/{id}', '/orders/status/{id}', '/health'],
        'POST': ['/orders', '/orders/checkout'],
        'PUT': ['/orders/{id}', '/orders/{id}/status'],
        'DELETE': ['/orders/{id}']
    },
    'inventory-service': {
        'GET': ['/inventory', '/inventory/{id}', '/stock/{id}', '/health'],
        'POST': ['/inventory', '/stock/reserve'],
        'PUT': ['/inventory/{id}', '/stock/{id}'],
        'DELETE': ['/inventory/{id}']
    }
}

SERVICES = list(SERVICE_ENDPOINTS.keys())
ENVIRONMENTS = ['production']

INFO_MESSAGES = [
    'Request processed successfully',
    'User authenticated',
    'Data fetched from cache',
    'Transaction completed',
    'Response sent to client',
    'Query executed successfully'
]

WARN_MESSAGES = [
    'Slow query detected',
    'Cache miss - fetching from database',
    'Rate limit approaching',
    'Deprecated API usage',
    'High memory usage detected'
]

ERROR_MESSAGES = [
    'Database connection timeout',
    'Invalid authentication token',
    'Resource not found',
    'Internal server error',
    'Failed to process payment',
    'Service unavailable',
    'Network timeout',
    'Permission denied',
    'Invalid request parameters',
    'External API call failed'
]


def generate_trace_id():
    """Generate a random 32-character hex trace ID"""
    return ''.join(random.choices('0123456789abcdef', k=32))


def generate_span_id():
    """Generate a random 16-character hex span ID"""
    return ''.join(random.choices('0123456789abcdef', k=16))


def generate_container_id():
    """Generate a realistic container ID"""
    return ''.join(random.choices('0123456789abcdef', k=64))


def generate_realistic_log():
    """Generate a realistic log entry with 2% error rate"""
    is_error = random.random() < ERROR_RATE

    # Select log level and corresponding data
    if is_error:
        level = 'ERROR'
        status_code = random.choice([500, 502, 503, 504, 400, 401, 403, 404])
        message_template = random.choice(ERROR_MESSAGES)
    else:
        level_choice = random.choices(
            ['INFO', 'WARN', 'DEBUG'],
            weights=[0.80, 0.15, 0.05],
            k=1
        )[0]
        level = level_choice

        if level == 'WARN':
            status_code = random.choice([200, 304, 400, 429])
            message_template = random.choice(WARN_MESSAGES)
        else:
            status_code = random.choice([200, 201, 204, 304])
            message_template = random.choice(INFO_MESSAGES)

    # Select service first
    service = random.choice(SERVICES)
    environment = random.choice(ENVIRONMENTS)

    # Select HTTP method and path relevant to the service
    service_endpoints = SERVICE_ENDPOINTS[service]
    method = random.choice(list(service_endpoints.keys()))
    path = random.choice(service_endpoints[method])

    # Replace {id} placeholders with random IDs
    if '{id}' in path:
        path = path.replace('{id}', str(random.randint(1, 1000)))

    # Base log structure
    log = {
        'timestamp': (datetime.now(timezone.utc) - timedelta(seconds=random.randint(0, 10))).isoformat(),
        'type': 'log',
        'service_name': service,
        'environment': environment,
        'level': level,
        'message': f'{message_template}: {method} {path}',
        'trace_id': generate_trace_id(),
        'span_id': generate_span_id(),
        'http_method': method,
        'http_path': path,
        'http_status_code': status_code,
    }

    # Add duration (slower for errors)
    if is_error:
        duration = random.uniform(500, 1000)  # 500ms to 1s for errors
    else:
        duration = random.uniform(100, 200)  # 100ms to 200ms for normal requests

    # Randomly choose log format (to match your examples)
    format_type = random.choice(['format1', 'format2'])

    if format_type == 'format1':
        # Format like first example
        log.update({
            'duration_ms': round(duration, 2),
            'client_ip': f'::ffff:192.168.{random.randint(1, 255)}.{random.randint(1, 255)}',
            'container_id': generate_container_id(),
            'container_name': f'/panopticon-{service}',
            'source': 'stdout'
        })
    else:
        # Format like second example
        log.update({
            'labels': {
                'duration_ms': round(duration, 0)
            },
            'stream': 'stdout',
            'time': datetime.now(timezone.utc).isoformat(),
            'filepath': f'/var/lib/docker/containers/{generate_container_id()[:12]}/log.json'
        })

    return log


def generate_realistic_span_chain():
    """
    Generate a realistic span chain representing a request flow:
    HTTP Request -> Request Handler -> Database/MongoDB

    All spans share the same trace_id and are connected via parent_span_id
    """
    # Select service first
    service = random.choice(SERVICES)
    environment = random.choice(ENVIRONMENTS)

    # Select HTTP method and path relevant to the service
    service_endpoints = SERVICE_ENDPOINTS[service]
    method = random.choice(list(service_endpoints.keys()))
    path = random.choice(service_endpoints[method])

    if '{id}' in path:
        path = path.replace('{id}', str(random.randint(1, 1000)))

    # Shared trace ID for all spans in this chain
    trace_id = generate_trace_id()

    # Base timestamp
    base_time = datetime.now(timezone.utc) - timedelta(milliseconds=random.randint(100, 2000))

    # Generate span IDs
    root_span_id = generate_span_id()
    handler_span_id = generate_span_id()
    db_span_id = generate_span_id()

    # Calculate durations (child spans must be shorter and within parent timeframe)
    # Error requests take ~500ms, normal requests take 100-200ms
    is_error_span = random.random() < ERROR_RATE
    if is_error_span:
        total_duration = random.uniform(500, 1000)  # 500ms to 1s for errors
    else:
        total_duration = random.uniform(100, 200)  # 100ms to 200ms for normal requests

    handler_duration = total_duration * random.uniform(0.8, 0.95)  # Handler takes most time
    db_duration = handler_duration * random.uniform(0.1, 0.3)  # DB is subset of handler

    # HTTP Status with 2% error rate (use same flag as duration)
    if is_error_span:
        http_status = random.choice([400, 401, 404, 500, 502, 503])
        status = "ERROR"
    else:
        http_status = random.choice([200, 201, 204, 304])
        status = "OK"

    spans = []

    # 1. Root Span - HTTP Server Request (SERVER kind)
    root_span = {
        'type': 'span',
        'timestamp': base_time.isoformat(),
        'service_name': service,
        'environment': environment,
        'trace_id': trace_id,
        'span_id': root_span_id,
        'parent_span_id': None,
        'name': f'{method} {path}',
        'kind': 'SERVER',
        'duration_ms': round(total_duration, 6),
        'status': status,
        'etc': {
            'http.url': f'http://localhost:3000{path}',
            'http.host': 'localhost:3000',
            'net.host.name': 'localhost',
            'http.scheme': 'http',
            'http.user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'http.request_content_length_uncompressed': random.randint(20, 1000),
            'http.flavor': '1.1',
            'net.transport': 'ip_tcp',
            'net.host.ip': f'::ffff:172.18.0.{random.randint(2, 10)}',
            'net.host.port': 3000,
            'net.peer.ip': f'::ffff:172.21.100.{random.randint(1, 254)}',
            'net.peer.port': random.randint(10000, 65000),
            'http.status_text': 'OK' if http_status < 400 else 'ERROR'
        },
        'http_method': method,
        'http_path': path,
        'http_status_code': http_status
    }
    spans.append(root_span)

    # 2. Request Handler Span (INTERNAL kind)
    handler_start = base_time + timedelta(milliseconds=random.uniform(1, 5))
    handler_span = {
        'type': 'span',
        'timestamp': handler_start.isoformat(),
        'service_name': service,
        'environment': environment,
        'trace_id': trace_id,
        'span_id': handler_span_id,
        'parent_span_id': root_span_id,
        'name': f'request handler - {path}',
        'kind': 'INTERNAL',
        'duration_ms': round(handler_duration, 6),
        'status': 'OK',
        'etc': {
            'express.name': path,
            'express.type': 'request_handler'
        },
        'http_path': path
    }
    spans.append(handler_span)

    # 3. Database Span (CLIENT kind) - randomly choose mongoose or mongodb
    db_type = random.choice(['mongoose', 'mongodb'])
    db_start = handler_start + timedelta(milliseconds=random.uniform(1, 10))

    if db_type == 'mongoose':
        # Mongoose operation
        operation = random.choice(['findOne', 'find', 'create', 'updateOne', 'deleteOne'])
        model = random.choice(['User', 'Post', 'Product', 'Order', 'Comment'])

        db_span = {
            'type': 'span',
            'timestamp': db_start.isoformat(),
            'service_name': service,
            'environment': environment,
            'trace_id': trace_id,
            'span_id': db_span_id,
            'parent_span_id': handler_span_id,
            'name': f'mongoose.{model}.{operation}',
            'kind': 'CLIENT',
            'duration_ms': round(db_duration, 6),
            'status': 'OK'
        }
    else:
        # MongoDB operation
        db_operation = random.choice(['find', 'findOne', 'insert', 'update', 'delete'])
        collection = random.choice(['users', 'posts', 'products', 'orders', 'comments'])

        db_span = {
            'type': 'span',
            'timestamp': db_start.isoformat(),
            'service_name': service,
            'environment': environment,
            'trace_id': trace_id,
            'span_id': db_span_id,
            'parent_span_id': handler_span_id,
            'name': f'mongodb.{db_operation}',
            'kind': 'CLIENT',
            'duration_ms': round(db_duration, 6),
            'status': 'OK',
            'etc': {
                'db.system': 'mongodb',
                'db.name': f'{service}_db',
                'db.mongodb.collection': collection,
                'db.operation': db_operation,
                'db.connection_string': f'mongodb://172.18.0.3:27017/{service}_db',
                'net.peer.name': '172.18.0.3',
                'net.peer.port': 27017,
                'db.statement': f'{{"find":"{collection}","filter":{{}},"limit":10}}'
            }
        }

    spans.append(db_span)

    return spans


class UserSimulationTest(HttpUser):
    """
    Simulates realistic user traffic with logs and spans.

    Sends logs with 1% error rate over several hours.
    """

    # Wait time between requests (simulating real user behavior)
    wait_time = between(0.1, 0.5)

    # Override host with environment variable or default
    host = PRODUCER_URL

    @task(2)  # 60% weight for logs
    def send_realistic_logs(self):
        """Send realistic log data"""
        # Send batch of 1-5 logs
        # batch_size = random.randint(1, 5)
        batch_size = 15
        batch_data = [generate_realistic_log() for _ in range(batch_size)]

        with self.client.post(
            '/dummy/logs',
            json=batch_data,
            catch_response=True,
            name=f'POST /dummy/logs (batch of {batch_size})'
        ) as response:
            if response.status_code == 202:
                response.success()
            else:
                response.failure(f'Expected 202, got {response.status_code}')

    @task(8)  # 40% weight for spans
    def send_realistic_spans(self):
        """Send realistic span chain data"""
        # Generate a span chain (HTTP -> Handler -> DB)
        # Each chain contains 3 connected spans sharing the same trace_id
        span_chain = generate_realistic_span_chain()

        # Send all spans in the chain together
        with self.client.post(
            '/dummy/traces',
            json=span_chain,
            catch_response=True,
            name=f'POST /dummy/traces (chain of {len(span_chain)})'
        ) as response:
            if response.status_code == 202:
                response.success()
            else:
                response.failure(f'Expected 202, got {response.status_code}')


# Event handlers for test lifecycle
@events.test_start.add_listener
def on_test_start(environment, **_kwargs):
    """Print test configuration when test starts"""
    if not isinstance(environment.runner, MasterRunner):
        print("\n" + "="*80)
        print("🚀 Locust User Simulation Test Starting")
        print("="*80)
        print(f"Target Server: {PRODUCER_URL}")
        print(f"Services: {', '.join(SERVICES)}")
        print(f"Error Rate: {ERROR_RATE * 100}%")
        print(f"\nData Types:")
        print(f"  - Logs: INFO (80%), WARN (15%), ERROR (2%), DEBUG (4%)")
        print(f"  - Logs Duration: Normal 100-200ms, Error 500-1000ms")
        print(f"  - Spans: HTTP -> Handler -> Database chains (3 spans per chain, 2% error)")
        print(f"  - Spans Duration: Normal 100-200ms, Error 500-1000ms")
        print(f"\nTask Weights: Logs (60%), Spans (40%)")
        print(f"\nThis test will run continuously until stopped.")
        print(f"Use --run-time flag to set duration (e.g., --run-time 3h)")
        print("="*80 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **_kwargs):
    """Print summary when test stops"""
    if not isinstance(environment.runner, MasterRunner):
        stats = environment.stats.total

        print("\n" + "="*80)
        print("✅ Locust User Simulation Test Completed")
        print("="*80)
        print(f"Total HTTP Requests: {stats.num_requests:,}")
        print(f"Total Failures: {stats.num_failures:,}")
        print(f"Average Response Time: {stats.avg_response_time:.2f}ms")
        print(f"Requests/sec: {stats.total_rps:.2f}")
        print("\nDetailed metrics available in Locust web UI or HTML report")
        print("="*80 + "\n")
