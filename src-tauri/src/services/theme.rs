//! Color mode: the appearance the interface is rendered in.

/// Appearance chosen in the settings page; `System` follows the operating system.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ColorMode {
    Dark,
    Light,
    System,
}

impl ColorMode {
    pub const DEFAULT: Self = Self::System;

    pub const ALL: [Self; 3] = [Self::Dark, Self::Light, Self::System];

    #[must_use]
    pub const fn code(self) -> &'static str {
        match self {
            Self::Dark => "dark",
            Self::Light => "light",
            Self::System => "system",
        }
    }

    #[must_use]
    pub fn from_code(code: &str) -> Option<Self> {
        match code {
            "dark" => Some(Self::Dark),
            "light" => Some(Self::Light),
            "system" => Some(Self::System),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_mode_round_trips_through_its_code() {
        for mode in ColorMode::ALL {
            assert_eq!(ColorMode::from_code(mode.code()), Some(mode));
        }
    }

    #[test]
    fn unknown_codes_are_rejected() {
        assert_eq!(ColorMode::from_code("sepia"), None);
    }
}
