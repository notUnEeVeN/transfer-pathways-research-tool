import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))          # analysis/tests (pmt_scenarios, helpers)
sys.path.insert(0, str(HERE.parent))   # analysis (pmt_eligibility, production port)
