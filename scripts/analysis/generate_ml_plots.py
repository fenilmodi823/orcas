from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns

OUTPUT_DIR = Path(__file__).resolve().parent / "output_graphs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Set high-resolution for poster printing
plt.rcParams["figure.dpi"] = 300
plt.rcParams["savefig.dpi"] = 300


# ==========================================
# PLOT 1: Confusion Matrix (93% Accuracy)
# ==========================================
def plot_confusion_matrix():
    plt.figure(figsize=(7, 6))

    # Mock data representing 93% accuracy on a test set of 1000 objects
    # [True Debris (745), False Payload (45)]
    # [False Debris (25), True Payload (185)]
    cm_data = np.array([[745, 45], [25, 185]])

    labels = ["Orbital Debris", "Active Payload"]

    sns.heatmap(
        cm_data,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=labels,
        yticklabels=labels,
        annot_kws={"size": 20, "weight": "bold"},
    )

    plt.title("Random Forest Classification Matrix", fontsize=18, pad=20, weight="bold")
    plt.ylabel("Actual Category", fontsize=14, weight="bold")
    plt.xlabel("Predicted Category", fontsize=14, weight="bold")

    plt.xticks(fontsize=12)
    plt.yticks(fontsize=12, rotation=0)

    plt.tight_layout()
    out_path = OUTPUT_DIR / "confusion_matrix.png"
    plt.savefig(out_path)
    print(f"Generated: {out_path}")
    plt.close()


# ==========================================
# PLOT 2: Feature Importance (Random Forest)
# ==========================================
def plot_feature_importance():
    plt.figure(figsize=(8, 5))

    # SGP4/TLE Features and their relative importance to the ML model
    features = [
        "BSTAR (Drag/Decay)",
        "Mean Motion",
        "Eccentricity",
        "Inclination",
        "Argument of Perigee",
    ]
    importance = [0.42, 0.28, 0.16, 0.09, 0.05]

    # Create horizontal bar chart
    sns.barplot(x=importance, y=features, hue=features, palette="viridis", legend=False)

    plt.title(
        "ML Feature Importance (Random Forest)", fontsize=18, pad=15, weight="bold"
    )
    plt.xlabel(
        "Relative Importance (Gini Impurity Decrease)", fontsize=14, weight="bold"
    )

    plt.xticks(fontsize=12)
    plt.yticks(fontsize=12, weight="bold")

    # Add data labels
    for i, v in enumerate(importance):
        plt.text(
            v + 0.01,
            i,
            f"{v:.2f}",
            color="black",
            va="center",
            fontsize=12,
            weight="bold",
        )

    # Remove top/right borders for cleanliness
    sns.despine()

    plt.tight_layout()
    plt.xlim(0, 0.5)
    out_path = OUTPUT_DIR / "feature_importance.png"
    plt.savefig(out_path)
    print(f"Generated: {out_path}")
    plt.close()


if __name__ == "__main__":
    print("Generating Academic Data Visualizations...")
    plot_confusion_matrix()
    plot_feature_importance()
    print(f"Done! Check the '{OUTPUT_DIR}' folder.")
