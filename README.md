# 🐔 Cacarejo Aim Lab

Treino de mira estilo CS com galinhas. Modos Normal, Strafe e Precisão.

Jogue: `https://SEU-USUARIO.github.io/cacarejo-aim-lab/`

## Ranking global (sem servidor)
O placar fica em `data/scores.json`, dentro do próprio repositório.

1. Ao fim da partida o jogador clica em **Enviar ao ranking global**: abre uma issue pré-preenchida no GitHub (precisa de conta).
2. A Action `.github/workflows/score.yml` roda `.github/scripts/score.js`, confere se o resultado é possível, atualiza o JSON e fecha a issue.
3. O jogo lê o JSON direto do repositório. Há 3 listas por modo: **Ovos**, **Precisão** e **Reação média**. Precisão e reação só contam com 15+ acertos na partida, para 1 acerto em 1 tiro não virar 100%.

O nome mostrado vem do nick digitado, e o `@usuário` do GitHub vem da própria issue (não dá para se passar por outra pessoa).

Limite honesto: o jogo roda no navegador, então o ranking é "na confiança". O bot só barra o que é impossível (acertos demais, ovos que não batem com acertos e headshots, reação abaixo de 150 ms).

## Requisitos no repositório
- Pages ligado (Settings → Pages → branch `main`, pasta `/`).
- Issues e Actions ligados (já vêm assim por padrão).
