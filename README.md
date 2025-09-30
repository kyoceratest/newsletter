# Newsletter Editor - Modèle KYOCERA

Un éditeur de newsletter web complet basé sur le design KYOCERA Document Solutions avec toutes les fonctionnalités demandées.

## 🎯 Caractéristiques

### ✅ Design et Structure
- **Header fixe** avec logo KYOCERA et navigation (non-éditable)
- **Footer** avec liens organisés en 3 colonnes et icônes réseaux sociaux (non-éditable)
- **Zone éditable** centrale avec interface intuitive
- **Design responsive** adapté à tous les écrans

### 🛠️ Outils d'Édition (Barre latérale gauche)

#### Insertion de Contenu
- **Images** : Local ou URL avec options d'édition (redimensionnement, suppression)
- **Vidéos** : Support YouTube, Vimeo et autres via URL
- **Texte** : Insertion de paragraphes
- **Tableaux** : Création avec en-têtes personnalisables

#### Outils de Formatage
- **Couleur du texte** : Sélecteur de couleur intégré
- **Édition d'images** : Outils MS Word-like (largeur, hauteur, suppression)
- **Édition de tableaux** : Toolbar flottant avec ajout/suppression lignes/colonnes, couleurs de fond

#### Actions
- **Annuler** : Système d'historique d'actions
- **Actualiser** : Rechargement sécurisé
- **Nettoyer** : Effacement du contenu avec confirmation

### 💾 Système de Sauvegarde

#### Sauvegarde Locale
- **Enregistrement** vers `C:\Newsletter` avec nom personnalisable
- **Format** : Fichiers HTML complets avec header/footer
- **Fallback** : Téléchargement automatique si serveur indisponible

#### Historique et Base de Données
- **Historique local** : 20 derniers travaux sauvegardés
- **Auto-save** : Sauvegarde automatique toutes les 30 secondes
- **Récupération** : Restauration des sessions interrompues
- **Gestion** : Chargement et suppression d'éléments d'historique

### ⌨️ Raccourcis Clavier
- **Ctrl+S** : Sauvegarde rapide
- **Ctrl+Z** : Annuler l'action précédente

## 🚀 Installation

### Option 1: Utilisation Simple (Recommandée)
1. Téléchargez tous les fichiers dans un dossier
2. Ouvrez `modèle_newsletter.html` dans votre navigateur
3. Commencez à éditer !

### Option 2: Avec Serveur Local (Pour sauvegarde automatique)
1. Installez un serveur web local (XAMPP, WAMP, ou autre)
2. Placez les fichiers dans le dossier web du serveur
3. Accédez via `http://localhost/newsletter/modèle_newsletter.html`

## 📁 Structure des Fichiers

```
newsletter/
├── modèle_newsletter.html    # Page principale éditable
├── styles.css               # Styles CSS complets
├── editor.js                # Fonctionnalités JavaScript
├── save_file.php            # Script de sauvegarde serveur
└── README.md               # Ce fichier
```

## 🎨 Utilisation

### Démarrage
1. Ouvrez `modèle_newsletter.html`
2. La zone centrale est éditable - cliquez pour commencer
3. Utilisez les outils de la barre latérale gauche

### Insertion d'Images
1. Cliquez sur "Insérer Image"
2. Choisissez "Image locale" ou "Image URL"
3. Cliquez sur l'image pour la redimensionner/supprimer

### Insertion de Vidéos
1. Cliquez sur "Insérer Vidéo"
2. Collez l'URL (YouTube/Vimeo)
3. La vidéo s'intègre automatiquement

### Création de Tableaux
1. Cliquez sur "Insérer Tableau"
2. Définissez lignes et colonnes
3. Cliquez sur le tableau pour afficher les outils d'édition

### Sauvegarde
1. Entrez un nom dans le champ "Nom du fichier"
2. Cliquez sur "Enregistrer"
3. Le fichier est sauvé dans `C:\Newsletter`

### Historique
1. Cliquez sur "Historique"
2. Consultez vos précédents travaux
3. Chargez ou supprimez selon vos besoins

## 🎯 Fonctionnalités Avancées

### Auto-Save
- Sauvegarde automatique toutes les 30 secondes
- Récupération en cas de fermeture accidentelle
- Données stockées localement dans le navigateur

### Responsive Design
- Interface adaptée mobile/tablette
- Barre latérale repliable sur petits écrans
- Navigation optimisée tactile

### Système d'Historique
- 50 actions d'annulation maximum
- Stockage local de 20 projets maximum
- Horodatage automatique

## 📝 Notes Techniques

### Compatibilité
- **Navigateurs** : Chrome, Firefox, Safari, Edge (versions récentes)
- **Système** : Windows, macOS, Linux
- **Résolution** : Optimisé pour 1920x1080, adaptatif

### Sauvegarde
- **Serveur requis** pour sauvegarde automatique en `C:\Newsletter`
- **Fallback** : Téléchargement manuel si pas de serveur
- **Format** : HTML complet avec CSS inline

### Sécurité
- Validation des noms de fichiers
- Protection contre les injections
- Limitations de taille raisonnables

## 🐛 Dépannage

### La sauvegarde ne fonctionne pas
1. Vérifiez que le dossier `C:\Newsletter` existe
2. Utilisez un serveur local pour les sauvegardes automatiques
3. En dernier recours, utilisez le téléchargement manuel

### Les images ne s'affichent pas
1. Vérifiez l'URL de l'image
2. Assurez-vous que l'image est accessible publiquement
3. Privilégiez les images locales pour la distribution

### Interface déformée
1. Actualisez la page (F5)
2. Vérifiez que tous les fichiers CSS sont chargés
3. Testez dans un autre navigateur

## 🔄 Mises à Jour

Le système inclut :
- Horodatage automatique des modifications
- Lien de retour vers la page d'édition principale
- Sauvegarde des métadonnées dans l'historique

---

**Développé selon les spécifications KYOCERA Document Solutions**
**Design basé sur : https://www.kyoceradocumentsolutions.fr/fr/smarter-workspaces/insights-hub/newsletters/**
