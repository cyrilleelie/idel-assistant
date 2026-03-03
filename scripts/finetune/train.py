"""Fine-tuning QLoRA de Mistral Small 3.1 sur le corpus IDEL synthétique.

À exécuter sur une instance Vast.ai (A10 ou A100) :
  vast create instance {id} --image pytorch/pytorch:latest
  # Copier le corpus et ce script, puis :
  pip install unsloth trl datasets
  python train.py

Durée estimée : 6-8h sur A10, 3-4h sur A100
Coût Vast.ai : ~4$ sur A10, ~8$ sur A100

Note : Données synthétiques uniquement — aucune donnée patient réelle.
Pas de contrainte HDS pour l'instance de fine-tuning.
"""

import os

from datasets import load_dataset
from unsloth import FastLanguageModel
from trl import SFTTrainer, SFTConfig

MODEL_NAME = "mistralai/Mistral-Small-3.1-24B-Instruct"
OUTPUT_DIR = "/outputs/idel-lora-v1"
MAX_SEQ_LENGTH = 4096


def main() -> None:
    print("=== Chargement du modele de base ===")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_NAME,
        max_seq_length=MAX_SEQ_LENGTH,
        load_in_4bit=True,       # QLoRA : quantification 4-bit
        dtype=None,              # Detection automatique (bf16 si disponible)
        token=os.environ.get("HF_TOKEN"),
    )

    print("=== Configuration LoRA ===")
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,                    # Rang LoRA — balance qualite/taille adaptateur
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=32,           # Scaling factor
        lora_dropout=0.05,
        bias="none",
        use_gradient_checkpointing="unsloth",  # Optimisation memoire Unsloth
        random_state=42,
    )

    print("=== Chargement du corpus ===")
    dataset = load_dataset(
        "json",
        data_files={
            "train": "/data/corpus/train.jsonl",
            "test": "/data/corpus/test.jsonl",
        },
    )
    print(f"  Train : {len(dataset['train'])} exemples")
    print(f"  Test  : {len(dataset['test'])} exemples")

    print("=== Demarrage fine-tuning ===")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset["train"],
        eval_dataset=dataset["test"],
        args=SFTConfig(
            # Entrainement
            num_train_epochs=3,
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,     # Batch effectif = 8
            learning_rate=2e-4,
            lr_scheduler_type="cosine",
            warmup_ratio=0.05,

            # Precision
            fp16=True,
            optim="adamw_8bit",                # Economise la VRAM

            # Logging
            logging_steps=50,
            eval_strategy="steps",
            eval_steps=500,
            save_steps=500,
            save_total_limit=2,

            # Outputs
            output_dir=OUTPUT_DIR,
            report_to="none",                  # Pas de W&B

            # Dataset
            max_seq_length=MAX_SEQ_LENGTH,
            dataset_num_proc=2,
            packing=True,                      # Optimisation Unsloth
        ),
    )

    trainer.train()

    print("=== Sauvegarde des adaptateurs LoRA ===")
    model.save_pretrained(f"{OUTPUT_DIR}/lora-adapters")
    tokenizer.save_pretrained(f"{OUTPUT_DIR}/lora-adapters")

    print(f"Fine-tuning termine. Adaptateurs sauvegardes dans {OUTPUT_DIR}/lora-adapters")
    print("Prochaine etape : evaluer avec evaluate.py, puis deployer sur OVH")


if __name__ == "__main__":
    main()
