"""Offline unit tests for deploy/smoke_test.py (the network is mocked).

Run (repo root):  python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'
CI runs it too (.github/workflows/ci-docker.yml).

Covers: public checks pass; a DB that is down fails even if HTTP answers.
If you change the endpoints in smoke_test.py, update `response()` below.
"""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('smoke', Path(__file__).parents[1] / 'smoke_test.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class SmokeTests(unittest.TestCase):
    def response(self, base, path, data=None, token=None):
        return {
            '/api/health': b'{"status":"ok","db":"up"}',
            '/': b'<html></html>',
        }[path]

    @patch.dict('os.environ', {}, clear=True)
    def test_public_checks_pass(self):
        with patch.object(smoke, 'request', side_effect=self.response) as req:
            smoke.check('https://demo.test')
            self.assertEqual(req.call_count, 2)

    @patch.dict('os.environ', {}, clear=True)
    def test_db_not_ready_fails_even_when_http_responds(self):
        def disconnected(base, path, **kwargs):
            return b'{"status":"ok","db":"down"}' if path == '/api/health' else self.response(base, path)
        with patch.object(smoke, 'request', side_effect=disconnected), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, '/api/health'):
                smoke.check('https://demo.test')


if __name__ == '__main__':
    unittest.main()
