extern crate actix;
extern crate actix_web;
#[macro_use] extern crate log;
extern crate env_logger;

mod rest;
mod irc;
use irc::ConnectionTracker;
use rest::IrcRestServer;

fn main() {
    std::env::set_var("RUST_LOG", "actix_web=info");
    env_logger::init();
    println!("Starting irc-conntrack");
    let tracker = ConnectionTracker::new();
    let srv = IrcRestServer::new("localhost:9995".to_string(), tracker);
    srv.start();
}
