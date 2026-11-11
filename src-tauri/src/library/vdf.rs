//! Parser mínimo del formato de texto KeyValues de Valve (`.vdf` / `.acf`).
//!
//! Soporta claves y valores entre comillas, secuencias de escape (`\\`, `\"`,
//! `\n`, `\t`), objetos anidados con `{ }` y comentarios `//`. Es suficiente
//! para `libraryfolders.vdf`, `appmanifest_*.acf`, `loginusers.vdf` y
//! `localconfig.vdf`.

#[derive(Debug, Clone, PartialEq)]
pub enum Vdf {
    Str(String),
    Obj(Vec<(String, Vdf)>),
}

impl Vdf {
    /// Busca una clave (sin distinguir mayúsculas, como hace Steam).
    pub fn get(&self, key: &str) -> Option<&Vdf> {
        match self {
            Vdf::Obj(entries) => entries
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(key))
                .map(|(_, v)| v),
            Vdf::Str(_) => None,
        }
    }

    /// Recorre una ruta de claves: `root.path(&["a", "b"])`.
    pub fn path(&self, keys: &[&str]) -> Option<&Vdf> {
        keys.iter().try_fold(self, |node, key| node.get(key))
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Vdf::Str(s) => Some(s),
            Vdf::Obj(_) => None,
        }
    }

    pub fn str_at(&self, key: &str) -> Option<&str> {
        self.get(key).and_then(Vdf::as_str)
    }

    pub fn entries(&self) -> &[(String, Vdf)] {
        match self {
            Vdf::Obj(entries) => entries,
            Vdf::Str(_) => &[],
        }
    }
}

/// Parsea un documento completo. El resultado es un objeto con las claves raíz.
pub fn parse(input: &str) -> Option<Vdf> {
    let mut parser = Parser { chars: input.chars().peekable() };
    let entries = parser.object_body(false)?;
    Some(Vdf::Obj(entries))
}

struct Parser<'a> {
    chars: std::iter::Peekable<std::str::Chars<'a>>,
}

enum Token {
    Str(String),
    Open,
    Close,
}

impl Parser<'_> {
    fn skip_ws_and_comments(&mut self) {
        loop {
            match self.chars.peek() {
                Some(c) if c.is_whitespace() => {
                    self.chars.next();
                }
                Some('/') => {
                    let mut clone = self.chars.clone();
                    clone.next();
                    if clone.peek() == Some(&'/') {
                        for c in self.chars.by_ref() {
                            if c == '\n' {
                                break;
                            }
                        }
                    } else {
                        return;
                    }
                }
                _ => return,
            }
        }
    }

    fn token(&mut self) -> Option<Token> {
        self.skip_ws_and_comments();
        match self.chars.next()? {
            '{' => Some(Token::Open),
            '}' => Some(Token::Close),
            '"' => {
                let mut s = String::new();
                while let Some(c) = self.chars.next() {
                    match c {
                        '"' => return Some(Token::Str(s)),
                        '\\' => match self.chars.next()? {
                            'n' => s.push('\n'),
                            't' => s.push('\t'),
                            other => s.push(other),
                        },
                        other => s.push(other),
                    }
                }
                None
            }
            // Token sin comillas (poco común): hasta el siguiente espacio.
            first => {
                let mut s = String::from(first);
                while let Some(&c) = self.chars.peek() {
                    if c.is_whitespace() || c == '{' || c == '}' || c == '"' {
                        break;
                    }
                    s.push(c);
                    self.chars.next();
                }
                Some(Token::Str(s))
            }
        }
    }

    /// Lee pares clave/valor hasta `}` (si `nested`) o hasta el final.
    fn object_body(&mut self, nested: bool) -> Option<Vec<(String, Vdf)>> {
        let mut entries = Vec::new();
        loop {
            match self.token() {
                None => return if nested { None } else { Some(entries) },
                Some(Token::Close) => return if nested { Some(entries) } else { None },
                Some(Token::Open) => return None,
                Some(Token::Str(key)) => {
                    let value = match self.token()? {
                        Token::Str(v) => Vdf::Str(v),
                        Token::Open => Vdf::Obj(self.object_body(true)?),
                        Token::Close => return None,
                    };
                    entries.push((key, value));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nested_objects_and_escapes() {
        let doc = r#"
            "libraryfolders"
            {
                "0"
                {
                    "path"    "C:\\Program Files (x86)\\Steam"
                    "apps" { "730" "123" }
                }
                // comentario
            }
        "#;
        let root = parse(doc).unwrap();
        let folder = root.path(&["libraryfolders", "0"]).unwrap();
        assert_eq!(folder.str_at("path"), Some(r"C:\Program Files (x86)\Steam"));
        assert_eq!(folder.path(&["apps", "730"]).and_then(Vdf::as_str), Some("123"));
        assert_eq!(root.path(&["LIBRARYFOLDERS", "0", "PATH"]).is_some(), true);
    }

    #[test]
    fn rejects_unbalanced_braces() {
        assert!(parse(r#""a" { "b" "c" "#).is_none());
    }
}
