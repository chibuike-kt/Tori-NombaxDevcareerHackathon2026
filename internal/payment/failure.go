package payment

import (
	"fmt"
	"os"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"gopkg.in/yaml.v3"
)

type failureCodeEntry struct {
	Code        string `yaml:"code"`
	Category    string `yaml:"category"`
	Description string `yaml:"description"`
}

type failureConfig struct {
	FailureCodes []failureCodeEntry `yaml:"failure_codes"`
	Default      struct {
		Category string `yaml:"category"`
		LogLevel string `yaml:"log_level"`
		Message  string `yaml:"message"`
	} `yaml:"default"`
}

// Classifier maps Nomba failure codes to RETRIABLE or NON_RETRIABLE.
type Classifier struct {
	codes map[string]domain.FailureCategory
}

func LoadClassifier(configPath string) (*Classifier, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("reading failure codes config: %w", err)
	}

	var cfg failureConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing failure codes config: %w", err)
	}

	codes := make(map[string]domain.FailureCategory, len(cfg.FailureCodes))
	for _, entry := range cfg.FailureCodes {
		codes[entry.Code] = domain.FailureCategory(entry.Category)
	}

	return &Classifier{codes: codes}, nil
}

// Classify returns the failure category for a given Nomba failure code.
// Unknown codes default to RETRIABLE and should be investigated.
func (c *Classifier) Classify(failureCode string) domain.FailureCategory {
	if cat, ok := c.codes[failureCode]; ok {
		return cat
	}
	return domain.FailureRetriable
}

func (c *Classifier) IsRetriable(failureCode string) bool {
	return c.Classify(failureCode) == domain.FailureRetriable
}

// NewClassifierFromMap constructs a Classifier directly from a map.
// Used in tests to avoid filesystem dependency.
func NewClassifierFromMap(codes map[string]domain.FailureCategory) *Classifier {
	return &Classifier{codes: codes}
}
