import socket

def test_socket():
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect(('localhost', 7336))  # Replace with your port
        print("Socket connected successfully.")
        # Test receiving data
        data = sock.recv(1024)
        print("Received data:", data)
        sock.close()
    except socket.error as e:
        print("Socket error:", e)

if __name__ == "__main__":
    test_socket()
