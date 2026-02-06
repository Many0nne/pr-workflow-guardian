# 🔄 Changelog - Version 2.0

## Transformation majeure : de "Contrôleur" à "Enseignant"

Guardian PR passe d'un simple vérificateur binaire (✅/❌) à un **outil pédagogique qui force la compréhension**.

---

## ✨ Nouveautés principales

### 1. **Qualification des violations**
- Chaque règle a une **severity** : `block` (bloquant) ou `warn` (avertissement)
- Messages **explicites** : pourquoi la règle, comment corriger
- Structure uniforme dans les commentaires PR

**Avant :**
```
- Section "How to test" trop courte
```

**Après :**
```
**Test Instructions**
> Instructions too brief (12 chars, minimum: 50)
**What to do:** Provide detailed, numbered steps for testing
```

---

### 2. **Durcissement du contenu des sections**
Guardian ne valide plus seulement la **présence** mais aussi la **qualité**:

- ❌ Détecte et rejette les **placeholders** : TODO, N/A, FIXME, "same as before"
- ❌ Exige des **verbes d'action** dans les instructions de test
- ❌ Rejette les **titres génériques** : "fix", "update", "stuff"
- ❌ Valide une **longueur minimale réelle** du contenu (pas 5 caractères)

**Exemple rejeté :**
```markdown
## How to test
Test it
```

**Exemple accepté :**
```markdown
## How to test
1. Run `npm run dev` to start the server
2. Navigate to /settings/privacy
3. Verify the setting persists after page refresh
```

---

### 3. **Vérifications de cohérence**
Nouveau : Guardian vérifie que le **titre, les labels et le contenu s'alignent**.

- Title doit refleter le type de label
- Pas de titres trompeurs
- Coherence entre description et classification

---

### 4. **Feedback structuré et éducatif**
Les commentaires dans les PR sont maintenant :
- Structurés avec sections claires
- Contiennent l'action attendue
- Expliquent l'intention derrière chaque règle

```markdown
❌ **Guardian: Merge Blocked**

### 🚫 Blocking Issues

**Test Instructions**
> Instructions too brief (12 chars, minimum: 50)

**What to do:** Provide detailed, numbered steps for testing
```

---

### 5. **Mécanisme d'override encadré**
Les développeurs peuvent **dépasser les règles** si justifié :

1. Ajouter le label `guardian:override`
2. Poster un commentaire avec la raison

→ Exception visible, traçable, documentée

---

### 6. **Documentation des règles explicite**
Chaque règle dans `guardian.yml` inclut :
- **description** : pourquoi la règle existe
- **examples** : bons/mauvais cas
- **config** : paramètres ajustables

Les équipes peuvent **comprendre et contester** les règles.

---

## 📋 Configuration nouvelle

La configuration est maintenant hiérarchisée :

```yaml
rules:
  title_quality:
    enabled: true
    severity: block
    description: "PR titles must be descriptive..."
    config:
      min_length: 10
      reject_generic: true
    examples:
      bad: ["fix", "update"]
      good: ["fix: race condition in cache", "feat: add OAuth2"]
  
  test_instructions:
    enabled: true
    severity: block
    description: "Must include actionable steps..."
    config:
      min_length: 50
      must_have_action_verbs: true
      reject_placeholders: true
```

---

## 🚀 Migration depuis l'ancienne version

### Fichier `guardian.yml`

**L'ancien format :**
```yaml
approvals_required: 1
required_type_labels: ["type: fix", "type: feature"]
min_md_sections: 3
```

**Reste **compatible**, mais pour bénéficier des nouvelles fonctionnalités, utilisez le nouveau format :**
```yaml
rules:
  approvals:
    enabled: true
    severity: block
    required: 1
  
  type_labels:
    enabled: true
    severity: block
    required_labels: ["type: fix", "type: enhancement"]
```

### Rien à changer côté workflow GitHub

Le fichier `.github/workflows/guardian.yml` fonctionne sans modification.

---

## 🎯 Règles activées par défaut

| Règle | Blocage | Description |
|-------|---------|-------------|
| Title Quality | ✅ Block | Titre ≥10 caractères, pas générique |
| Description Structure | ✅ Block | ≥3 sections avec ≥30 caractères chacune |
| Test Instructions | ✅ Block | ≥50 caractères, verbes d'action, pas placeholders |
| Type Labels | ✅ Block | Au moins 1 label type |
| Coherence | ⚠️ Warn | Title/label alignement |
| Assignees | ⚠️ Warn | Au moins 1 assignee |
| Approvals | ✅ Block | Au moins 1 approbation |
| CI Checks | ✅ Block | Tous les checks passent |
| Ticket Reference | ✅ Block | Référence à ticket ou issue |

---

## 📚 Cas d'usage réel

### Avant
```
PR: "Fix: bug"
Description: "Fixed issues"
How to test: "Test it"
→ Merge bloqué
```

Développeur ajoute rapidement du texte au hasard pour passer.

### Après
```
PR: "Fix: bug"
Description: "Fixed issues"
How to test: "Test it"
→ Multiple violations détectées et expliquées
  - Title too generic
  - Description too vague
  - Test instructions lack action verbs
```

Développeur est **forcé** de réfléchir et produit :

```
PR: "fix: prevent null pointer in payment validator"
Description: "Addresses race condition where concurrent payment requests..."
How to test: 
  1. Run `npm run dev`
  2. Trigger concurrent checkout requests
  3. Verify all complete successfully
```

---

## ⚠️ Breaking Changes

- L'ancien format `guardian.yml` simple fonctionne toujours (backward compatible)
- Les violations incluent maintenant plus d'information (commentaires plus longs)
- Les seuils de longueur minimale sont **plus stricts** (was 20, now 30 chars)

---

## 🔧 Configuration recommandée pour les solos

```yaml
rules:
  approvals:
    required: 0  # Pas d'approbation requise pour solo
  
  # Toutes les autres règles restent activées
```

---

## 🤝 Feedback & Override

Si une règle semble incorrecte pour votre cas :

1. Ajouter le label `guardian:override`
2. Poster un commentaire avec la justification
3. Merge autorisé
4. Exception enregistrée pour analyse

Example:
```
Label: guardian:override

Comment:
reason: Emergency hotfix for production outage. 
Users cannot process payments.
accept_risk: Reduced testing window (30 minutes). Full regression testing after deployment.
```

---

## 📖 Pour plus de détails

Voir [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) pour une documentation complète des changements.
