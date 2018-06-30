extern crate protobuf;

use std::fmt::{Display, Formatter, Error};
mod proto;
use proto::PingPong::Ping;
use protobuf::Message;

fn main() {
    let mut my_ping = Ping::new();
    my_ping.set_timestamp_ms(64);
    let mut bytes = Vec::<u8>::new();
    my_ping.write_to_vec(&mut bytes);
    println!("{:?}", bytes);
}
