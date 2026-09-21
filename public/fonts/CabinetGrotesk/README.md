# Cabinet Grotesk — fichier manquant

`tokens.css` référence `/fonts/CabinetGrotesk/CabinetGrotesk-Variable.woff2` via
`@font-face`, mais le fichier n'a pas pu être téléchargé automatiquement :
le réseau sortant de cet environnement bloque `api.fontshare.com` (refus de
politique, pas une erreur transitoire).

À faire une fois que tu as le fichier :

1. Télécharger la variable woff2 de Cabinet Grotesk sur
   [Fontshare](https://www.fontshare.com/fonts/cabinet-grotesk) (open source).
2. La déposer ici sous le nom exact `CabinetGrotesk-Variable.woff2`.
3. Rien d'autre à changer — `tokens.css` pointe déjà dessus. En attendant,
   `--b-font-sans` retombe proprement sur `-apple-system` / `Segoe UI` /
   `sans-serif`.
