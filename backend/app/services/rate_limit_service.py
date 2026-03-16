from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock
from time import time

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str, max_requests: int, window_seconds: int) -> int | None:
        now = time()
        window_start = now - window_seconds

        with self._lock:
            bucket = self._events[key]
            while bucket and bucket[0] <= window_start:
                bucket.popleft()

            if len(bucket) >= max_requests:
                return max(1, int(bucket[0] + window_seconds - now))

            bucket.append(now)

        return None


rate_limiter = InMemoryRateLimiter()


def _get_client_identity(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def build_rate_limit_dependency(scope: str, max_requests: int, window_seconds: int):
    def dependency(request: Request) -> None:
        client_identity = _get_client_identity(request)
        retry_after = rate_limiter.check(
            key=f"{scope}:{client_identity}",
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Retry in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )

    return dependency
