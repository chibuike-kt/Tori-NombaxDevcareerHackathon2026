package main

import (
    "crypto/rand"
    "encoding/hex"
    "fmt"
    "os"
    "golang.org/x/crypto/argon2"
)

func main() {
    password := os.Args[1]
    salt := make([]byte, 16)
    if _, err := rand.Read(salt); err != nil {
        panic(err)
    }
    hash := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
    fmt.Printf("argon2id$%s$%s\n", hex.EncodeToString(salt), hex.EncodeToString(hash))
}
