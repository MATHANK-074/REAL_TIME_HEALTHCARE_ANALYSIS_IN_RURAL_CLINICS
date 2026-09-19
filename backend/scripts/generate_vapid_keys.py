import os
import json
from py_vapid import Vapid
import base64

def generate_keys():
    vapid = Vapid()
    vapid.generate_keys()
    
    private_key_b64 = base64.urlsafe_b64encode(vapid.private_key.private_numbers().private_value.to_bytes(32, 'big')).decode('utf-8').rstrip('=')
    
    # We can get the base64url encoded public key easily
    raw_pub = vapid.public_key.public_numbers().x.to_bytes(32, 'big') + vapid.public_key.public_numbers().y.to_bytes(32, 'big')
    # Uncompressed format starts with 0x04
    uncompressed_pub = b'\x04' + raw_pub
    public_key_b64 = base64.urlsafe_b64encode(uncompressed_pub).decode('utf-8').rstrip('=')
    
    print("VAPID Keys generated successfully!\n")
    print(f"VAPID_PUBLIC_KEY={public_key_b64}")
    print(f"VAPID_PRIVATE_KEY={private_key_b64}")
    print("VAPID_CLAIM_EMAIL=mailto:admin@ruralcare.local")
    print("\nREACT_APP_VAPID_PUBLIC_KEY=" + public_key_b64)

if __name__ == '__main__':
    generate_keys()
