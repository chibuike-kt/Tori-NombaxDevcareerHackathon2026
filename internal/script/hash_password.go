//go:build ignore

package main

import (
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	_ "crypto/subtle"

	"golang.org/x/crypto/argon2"
)

func main() {
	password := "tori-dev-2026"
	salt := []byte("tori-static-salt")
	hash := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	_ = subtle.ConstantTimeCompare // import used
	fmt.Println(hex.EncodeToString(hash))
}
