import importlib.util,io,json,pathlib,unittest
P=pathlib.Path(__file__).resolve().parents[1]/'skills/yi-ri-san-mai/scripts/mcp_readonly.py'
spec=importlib.util.spec_from_file_location('readonly',P);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Response:
    def __init__(self,payload,status=200,headers=None):self.payload=payload;self.status=status;self.headers=headers or {'Content-Type':'application/json'}
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self):return self.payload
    def __iter__(self):return iter(self.payload.splitlines(keepends=True))
class Transport:
    def __init__(self,responses):self.responses=iter(responses);self.requests=[]
    def open(self,req,timeout):self.requests.append(req);return next(self.responses)
class Tests(unittest.TestCase):
    def test_handshake_session_and_call(self):
        t=Transport([Response(b'{"result":{"protocolVersion":"2025-03-26"}}',headers={'Content-Type':'application/json','Mcp-Session-Id':'sample-session'}),Response(b'',202),Response(b'{"result":{"content":[]}}')]);c=m.Client('synthetic-test-value',t);c.initialize();c.call('query-meals',{'storeCode':'1980076','orderType':1,'beType':1})
        self.assertEqual([json.loads(r.data)['method'] for r in t.requests],['initialize','notifications/initialized','tools/call']);self.assertNotIn('id',json.loads(t.requests[1].data));self.assertEqual(t.requests[2].get_header('Mcp-session-id'),'sample-session');self.assertEqual(t.requests[2].get_header('Mcp-protocol-version'),'2025-03-26')
    def test_sse_matching_response(self):
        t=Transport([Response(b'data: {"id":99,"result":{}}\n\ndata: {"id":1,"result":{"ok":true}}\n\n',headers={'Content-Type':'text/event-stream'})]);self.assertTrue(m.Client('synthetic-test-value',t).rpc('tools/list')['result']['ok'])
    def test_transaction_is_rejected_before_transport(self):
        t=Transport([])
        with self.assertRaises(ValueError):m.Client('synthetic-test-value',t).call('create-order',{})
        self.assertEqual(t.requests,[])
if __name__=='__main__':unittest.main()
