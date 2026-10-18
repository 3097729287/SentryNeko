//! Backend localization: maps error codes to localized messages.

use crate::utils::response::{ApiCode, ApiError};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    ZhCn,
    EnUs,
}

impl Language {
    pub const DEFAULT: Self = Self::EnUs;

    pub const ALL: [Self; 2] = [Self::ZhCn, Self::EnUs];

    #[must_use]
    pub const fn code(self) -> &'static str {
        match self {
            Self::ZhCn => "zh-CN",
            Self::EnUs => "en-US",
        }
    }

    #[must_use]
    pub fn from_code(code: &str) -> Option<Self> {
        match code {
            "zh-CN" => Some(Self::ZhCn),
            "en-US" => Some(Self::EnUs),
            _ => None,
        }
    }

    /// Maps a system locale to an offered language, including regional and POSIX variants.
    #[must_use]
    pub fn from_locale(locale: &str) -> Option<Self> {
        let language = locale.split(['-', '_', '.', '@']).next()?;

        if language.eq_ignore_ascii_case("zh") {
            Some(Self::ZhCn)
        } else if language.eq_ignore_ascii_case("en") {
            Some(Self::EnUs)
        } else {
            None
        }
    }
}

impl ApiCode {
    #[must_use]
    pub const fn message_in(self, language: Language) -> &'static str {
        match language {
            Language::EnUs => self.default_message(),
            Language::ZhCn => match self {
                Self::Ok => "成功",
                Self::InvalidInput => "输入无效",
                Self::NotFound => "记录不存在",
                Self::Conflict => "状态冲突",
                Self::Database => "数据库错误",
                Self::Io => "输入输出错误",
                Self::PermissionDenied => "系统拒绝了该操作",
                Self::Unsupported => "暂不支持",
                Self::Internal => "内部错误",
            },
        }
    }
}

impl ApiError {
    #[must_use]
    pub fn localized(mut self, language: Language) -> Self {
        let code = self.code();
        if self.message() == code.default_message() {
            self = self.with_message(code.message_in(language));
        }
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CODES: [ApiCode; 9] = [
        ApiCode::Ok,
        ApiCode::InvalidInput,
        ApiCode::NotFound,
        ApiCode::Conflict,
        ApiCode::Database,
        ApiCode::Io,
        ApiCode::PermissionDenied,
        ApiCode::Unsupported,
        ApiCode::Internal,
    ];

    #[test]
    fn every_code_has_copy_in_every_language() {
        for code in CODES {
            for language in Language::ALL {
                assert!(
                    !code.message_in(language).is_empty(),
                    "{code:?} has no copy for {}",
                    language.code()
                );
            }
        }
    }

    #[test]
    fn english_copy_is_the_response_default() {
        for code in CODES {
            assert_eq!(code.message_in(Language::EnUs), code.default_message());
        }
    }

    #[test]
    fn chinese_copy_is_translated() {
        for code in CODES {
            assert_ne!(
                code.message_in(Language::ZhCn),
                code.default_message(),
                "{code:?} is still untranslated"
            );
        }
    }

    #[test]
    fn language_codes_round_trip_and_reject_others() {
        for language in Language::ALL {
            assert_eq!(Language::from_code(language.code()), Some(language));
        }

        assert_eq!(Language::DEFAULT, Language::EnUs);
        assert_eq!(Language::from_code("ja-JP"), None);
    }

    #[test]
    fn system_locales_resolve_to_supported_languages() {
        for locale in [
            "zh",
            "zh-CN",
            "zh-Hans-CN",
            "zh-TW",
            "ZH_cn.UTF-8",
            "zh_SG@pinyin",
        ] {
            assert_eq!(
                Language::from_locale(locale),
                Some(Language::ZhCn),
                "{locale}"
            );
        }

        for locale in ["en", "en-US", "en-GB", "EN_au.UTF-8"] {
            assert_eq!(
                Language::from_locale(locale),
                Some(Language::EnUs),
                "{locale}"
            );
        }

        for locale in ["", "C", "POSIX", "ja-JP", "fr-FR", "english", "zhongwen"] {
            assert_eq!(Language::from_locale(locale), None, "{locale}");
        }
    }

    #[test]
    fn localizing_keeps_specific_messages() {
        let generic = ApiError::new(ApiCode::NotFound).localized(Language::ZhCn);
        assert_eq!(generic.code(), ApiCode::NotFound);
        assert_eq!(generic.message(), "记录不存在");

        let specific = ApiError::invalid_input("title must not be empty").localized(Language::ZhCn);
        assert_eq!(specific.message(), "title must not be empty");
    }
}
