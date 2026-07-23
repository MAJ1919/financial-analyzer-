"""
Central logging configuration (NFR-S-03).

Establishes ONE logging convention for the whole backend so future debugging
code has a documented place to hook into:

    from app.core.logging_config import get_logger
    logger = get_logger(__name__)
    logger.info("forecast recomputed", extra={"project_id": pid})

Hard rule (NFR-S-03 — "No financial data shall be logged in server-side logs or
error messages"): log only IDENTIFIERS — project id, route, status code,
exception *type*. NEVER log request/response bodies, statement rows, cell values,
or any financial figure. The same rule applies to messages passed to
``raise ValueError(...)`` in the service layer (see CLAUDE.md gotchas).
"""
import logging

_CONFIGURED = False


def configure_logging(level: int = logging.INFO) -> None:
    """Idempotently configure root logging. Called once at app startup."""
    global _CONFIGURED
    if _CONFIGURED:
        return
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a module logger, ensuring logging is configured first."""
    configure_logging()
    return logging.getLogger(name)
