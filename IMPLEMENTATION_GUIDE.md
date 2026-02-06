# Guardian PR - Implementation Guide

## Vue d'ensemble des changements

Cette implémentation transforme Guardian de simple vérificateur de conformité à **outil pédagogique qui force la compréhension**.

### Principaux changements

---

## 1️⃣ **Qualification des violations** (Severity + Messages explicites)

### Avant
```
❌ Merge bloqué
- Section "How to test" trop courte (<20)
- Au moins 1 approbation requise
```

### Après
```
❌ **Guardian: Merge Blocked**

### 🚫 Blocking Issues

**Test Instructions**
> Instructions too brief (12 chars, minimum: 50)

**What to do:** Provide detailed, numbered steps for testing

**Approvals**
> 0 approval(s), 1 required

**What to do:** Request approval from at least one reviewer
```

**Impact** : Chaque violation inclut maintenant :
- Nom de la règle
- Description du problème spécifique
- Action attendue pour corriger

---

## 2️⃣ **Durcissement du contenu** (au-delà de la syntaxe)

### Détection de placeholders
Guardian refuse maintenant les sections contenant :
- `TODO`, `TBD`, `FIXME`
- `N/A`, `same as before`
- Textes trop génériques : "Test it", "Just test"

### Détection de verbes d'action
La section "How to Test" doit contenir des verbes comme :
- run, start, click, open, navigate, execute, install, build, verify

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
3. Click the toggle button
4. Verify that the setting persists after refresh
```

---

## 3️⃣ **Cohérence titre / labels / contenu**

### Nouvelle règle : Alignment

Si la PR est labelée `type: fix`, Guardian vérifie que :
- Le titre reflète le type (recommandation soft)
- La structure de la description est cohérente

**Exemple soft warning :**
```
Title: "Update dependencies"
Label: "type: fix"
Warning: Title doesn't reflect "type: fix" label
```

---

## 4️⃣ **Feedback structuré dans la PR**

Le commentaire Guardian est maintenant structuré et éducatif :

```markdown
❌ **Guardian: Merge Blocked**

### 🚫 Blocking Issues

**Test Instructions**
> Instructions too brief (12 chars, minimum: 50)

**What to do:** Provide detailed, numbered steps for testing

### ⚠️ Warnings (Non-blocking)

**Coherence**
> Title doesn't reflect "type: fix" label

---
Guardian enforces team standards to ensure clarity and traceability.
```

**Impact** : Les développeurs comprennent immédiatement ce qui est requis et pourquoi.

---

## 5️⃣ **Mécanisme d'override justifié**

### Comment utiliser

Si Guardian bloque à tort une PR :

1. **Ajouter le label** : `guardian:override`
2. **Poster un commentaire** contenant au minimum :
   ```
   reason: [Raison de l'exception]
   accept_risk: [Risques acceptés]
   ```

### Exemple
```
Label: guardian:override

Comment:
reason: Emergency hotfix for production outage (payment processing down).
accept_risk: Skipping full test cycle for 30-minute window. 
Will run comprehensive tests in 2 hours post-deployment.
```

**Impact** : L'override est visible dans l'historique → traçabilité et responsabilité.

---

## 6️⃣ **Documentation des règles dans la config**

Le fichier `guardian.yml` contient maintenant :
- **Description** : Pourquoi la règle existe
- **Examples** : Cas acceptés vs rejetés
- **Config** : Paramètres spécifiques

### Exemple extrait
```yaml
test_instructions:
  description: |
    "How to Test" section must include actionable steps.
    Prevents copy-paste instructions and ensures testability.
  
  config:
    min_length: 50
    must_have_action_verbs: true
    reject_placeholders: true
  
  examples:
    bad: |
      ## How to test
      Test it
    good: |
      ## How to test
      1. Run `npm run dev`
      2. Navigate to /settings/privacy
      3. Verify the toggle persists after refresh
```

**Impact** : Les équipes peuvent **comprendre, contester, ajuster** les règles.

---

## 🎯 Résumé de la transformation

| Aspect | Avant | Après |
|--------|-------|-------|
| **Nature** | Vérificateur binaire | Outil pédagogique |
| **Messages** | Génériques, laconiques | Explicites, éducatifs |
| **Contenu** | Syntaxe uniquement | Sémantique + syntaxe |
| **Feedback** | Log brut | Commentaire structuré |
| **Exceptions** | Aucune | Encadrées avec justification |
| **Documentation** | Configuration minimale | Descriptions + exemples |

---

## Configuration minimale recommandée

```yaml
rules:
  title_quality:
    enabled: true
    severity: block
  
  description_structure:
    enabled: true
    severity: block
    config:
      min_sections: 3
      min_chars_per_section: 30
  
  test_instructions:
    enabled: true
    severity: block
    config:
      min_length: 50
      must_have_action_verbs: true
      reject_placeholders: true
  
  type_labels:
    enabled: true
    severity: block
  
  approvals:
    enabled: true
    severity: block
    required: 1
```

---

## Cas d'usage réels

### Cas 1 : PR avec instructions de test insuffisantes

**Avant :**
```
Section "How to test" trop courte (<20)
```
→ Développeur rajoute 5 mots au hasard.

**Après :**
```
**Test Instructions**
> Instructions too brief (12 chars, minimum: 50)
> Instructions lack action verbs (run, click, verify, etc.)

**What to do:** Use imperative verbs: "Run the tests", "Click the button", "Verify the output"
```
→ Développeur écrit des instructions concrètes et testables.

---

### Cas 2 : PR avec titre générique

**Avant :**
```
Title: "Fix"
Label: "type: fix"
→ Pas d'erreur
```

**Après :**
```
Title: "Fix"
**Title Quality**
> Title is too short (3 chars, minimum: 10)

**What to do:** Use a descriptive title: "fix: race condition in cache" or "feat: add OAuth2 support"
```
→ Titre devient "fix: prevent null pointer in payment validator".

---

### Cas 3 : Override justifié

```yaml
Label: guardian:override

Comment:
reason: Production hotfix - user data export failing for 500+ users.
accept_risk: Skipping feature tests. Running critical path tests only.
```

**Impact** : Merge autorisé, exception documentée, équipe sait qu'il y a une raison.

---

## Activation progressive

Vous pouvez activer les règles progressivement :

```yaml
# Phase 1 : Juste les règles critiques
rules:
  title_quality:
    enabled: true
    severity: block
  description_structure:
    enabled: true
    severity: block

# Phase 2 : Ajouter les vérifications de contenu
  test_instructions:
    enabled: true
    severity: block

# Phase 3 : Ajouter cohérence et autres
  coherence_check:
    enabled: true
    severity: warn
```

---

## Points clés à retenir

✅ **Ce que ce changement accomplit :**
- Force l'effort cognitif, pas juste la conformité syntaxique
- Rend explicite pourquoi chaque règle existe
- Permet les exceptions justifiées
- Crée une culture d'intentionnalité plutôt que de conformité aveugle

⚠️ **Ce que ce changement ne fait PAS :**
- N'améliore pas la qualité du code lui-même
- N'empêche pas le remplissage mécanique (mais le rend plus coûteux)
- N'enseigne pas les meilleures pratiques (juste force un minimum)

🎯 **Prochaines étapes (optionnelles) :**
- Ajouter des checks NLP pour détecter le contenu générique
- Intégrer avec les templates PR pour guider les développeurs
- Créer des statistiques sur les violations les plus courantes
