"""Compatibility entry point for the authoritative 115-step authored importer."""
import sys
from import_market_authored import integrate

if __name__ == '__main__':
    # The complete import also writes the ordered course projection.
    integrate()
