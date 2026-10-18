#!/usr/bin/env python3
"""Optional stdlib-only, allowlisted MCP client. Token from environment only."""
import argparse,json,os,ssl,sys,urllib.request,urllib.error

ENDPOINT='https://mcp.mcd.cn'
ALLOWED={'list-nutrition-foods','query-nearby-stores','query-meals','query-meal-detail','calculate-price'}
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return None
class Client:
    def __init__(self,token,opener=None):
        self.token=token;self.session=None;self.version='2024-11-05';self.seq=0
        self.opener=opener or urllib.request.build_opener(NoRedirect(),urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    def rpc(self,method,params=None,notification=False):
        self.seq+=1;payload={'jsonrpc':'2.0','method':method}
        if not notification:payload['id']=self.seq
        if params is not None:payload['params']=params
        headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+self.token}
        if self.session:headers['Mcp-Session-Id']=self.session
        if method!='initialize':headers['MCP-Protocol-Version']=self.version
        req=urllib.request.Request(ENDPOINT,json.dumps(payload).encode(),headers,method='POST')
        with self.opener.open(req,timeout=30) as response:
            self.session=response.headers.get('Mcp-Session-Id',self.session)
            if response.status in (202,204):return {}
            if 'text/event-stream' in response.headers.get('Content-Type',''):
                for raw in response:
                    if raw.startswith(b'data:'):
                        try:value=json.loads(raw[5:].strip())
                        except (ValueError,UnicodeError):continue
                        if value.get('id')==self.seq:return value
                raise RuntimeError('No matching SSE response')
            return json.loads(response.read())
    def initialize(self):
        result=self.rpc('initialize',{'protocolVersion':self.version,'capabilities':{},'clientInfo':{'name':'yi-ri-san-mai-readonly','version':'1.5.0'}})
        if 'error' in result:raise RuntimeError('MCP initialize rejected')
        self.version=result['result'].get('protocolVersion',self.version)
        self.rpc('notifications/initialized',notification=True)
    def call(self,name,args):
        if name not in ALLOWED:raise ValueError('Tool outside read-only allowlist')
        return self.rpc('tools/call',{'name':name,'arguments':args})
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tool',choices=['list-tools']+sorted(ALLOWED))
    parser.add_argument('--arguments',default='{}',help='Tool JSON object; do not include credentials')
    options=parser.parse_args()
    try:
        args=json.loads(options.arguments)
        if not isinstance(args,dict):raise ValueError('Arguments must be an object')
        token=os.environ.get('MCD_MCP_TOKEN')
        if not token:raise ValueError('Configure MCD_MCP_TOKEN in the local environment; never commit it')
        client=Client(token);client.initialize()
        result=client.rpc('tools/list') if options.tool=='list-tools' else client.call(options.tool,args)
        if 'error' in result or result.get('result',{}).get('isError'):raise RuntimeError('MCP returned an error')
        print(json.dumps(result,ensure_ascii=False,indent=2))
    except (ValueError,RuntimeError) as exc:
        print(json.dumps({'error':str(exc)},ensure_ascii=False),file=sys.stderr);return 1
    except urllib.error.HTTPError as exc:
        print(json.dumps({'error':'HTTP request rejected','status':exc.code}),file=sys.stderr);return 1
    except Exception as exc:
        print(json.dumps({'error':type(exc).__name__}),file=sys.stderr);return 1
    return 0
if __name__=='__main__':sys.exit(main())
