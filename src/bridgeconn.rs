use std::io::Write;
use std::net::TcpListener;
use std::thread;


struct BridgeConn {
    transport: String,
}

trait BridgeTransport for BridgeConn {
    fn Connect(&self) -> bool;
}

trait BridgeSender for BridgeConn {
    
}

trait BridgeReciever for BridgeConn {

}
