import fs from "fs";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";

// Ensure we are working from the workspace root (/)
const rootDir = process.cwd();
const zipPath = path.join(rootDir, "hiperreforco-source.zip");
const instructionsPath = path.join(rootDir, "DECLARACAO_HASH_INPI.txt");

console.log("=== INICIANDO GERAÇÃO DO PACOTE DE REGISTRO INPI ===");
console.log(`Diretório Raiz: ${rootDir}`);

// 1. Criar arquivo ZIP
const zip = new AdmZip();

// Arquivos e pastas do código-fonte a incluir
const includes = [
  "src",
  "package.json",
  "vite.config.ts",
  "tsconfig.json",
  "index.html",
  "metadata.json",
  "firestore.rules",
  ".env.example",
  "AGENTS.md"
];

includes.forEach((item) => {
  const fullPath = path.join(rootDir, item);
  if (!fs.existsSync(fullPath)) return;

  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    zip.addLocalFolder(fullPath, item);
    console.log(`Adicionado diretório ao ZIP: ${item}/`);
  } else {
    zip.addLocalFile(fullPath);
    console.log(`Adicionado arquivo ao ZIP: ${item}`);
  }
});

// Escrever o arquivo ZIP
try {
  zip.writeZip(zipPath);
  console.log(`\nOK: Arquivo ZIP gerado com sucesso em: ${zipPath}`);
} catch (err) {
  console.error("Erro ao gerar arquivo ZIP:", err);
  process.exit(1);
}

// 2. Calcular o Hash SHA-256 do ZIP
const fileBuffer = fs.readFileSync(zipPath);
const hashSum = crypto.createHash("sha256");
hashSum.update(fileBuffer);
const sha256Hex = hashSum.digest("hex").toUpperCase();

console.log(`SHA-256 Calculado: ${sha256Hex}`);

// 3. Gerar Documento de Declaração e Instruções
const currentDateTime = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

const declarationContent = `========================================================================
             DECLARAÇÃO DE SEGREDO E RESUMO DIGITAL (HASH)
                    REGISTRO DE SOFTWARE - INPI
========================================================================

Esta declaração contém o resumo digital criptográfico (checksum SHA-256) gerado 
a partir do código-fonte do software para fins de comprovação de autoria e 
registro junto ao INPI (Instituto Nacional da Propriedade Industrial) do Brasil, 
em cumprimento à Lei nº 9.609/1998 (Lei do Software) e ao Decreto nº 10.114/2019.

------------------------------------------------------------------------
1. INFORMAÇÕES DO SOFTWARE
------------------------------------------------------------------------
Nome Comercial:     HiperReforço
Descrição Breve:    Aplicativo de reforço escolar inclusivo destinado a crianças
                     neurodivergentes (TDAH, TEA), integrando seus temas de
                     hiperfoco para um aprendizado altamente engajador.
Série/Versão:       1.0.0
Data de Geração:    25/05/2026 (UTC) - Geração Local em ${currentDateTime} (Horário de Brasília)
Linguagem Principal: TypeScript / React / Node.js
Arquitetura:        Single-Page Application (Vite + Tailwind CSS / Recharts / jsPDF)

------------------------------------------------------------------------
2. ARQUIVO DE CÓDIGO-FONTE BUNDLED
------------------------------------------------------------------------
Nome do Arquivo:    hiperreforco-source.zip
Tamanho do Arquivo: ${(fileBuffer.length / 1024).toFixed(2)} KB (${fileBuffer.length} bytes)
Algoritmo de Hash:  SHA-256

------------------------------------------------------------------------
3. RESUMO DIGITAL DO SOFTWARE (HASH SHA-256)
------------------------------------------------------------------------
O hash abaixo é o identificador único e inviolável do seu código-fonte.
Guarde-o bem e utilize-o exatamente como está na tela do formulário do INPI:

👉 HASH SHA-256: ${sha256Hex}

------------------------------------------------------------------------
4. PASSO A PASSO PARA REGISTRO NO PORTAL E-INPI
------------------------------------------------------------------------
Siga rigorosamente as etapas abaixo para registrar a sua marca e patente de código-fonte:

Etapa 1: Acesso ao Portal e Cadastro
- Acesse o portal oficial: https://www.gov.br/inpi
- Clique em "Serviços" > "Programa de Computador".
- Faça cadastro ou faça o login via Gov.br (com conta nível prata ou ouro).

Etapa 2: Pagamento da Guia de Recolhimento da União (GRU)
- Emita a GRU para o serviço código 512: "Pedido de registro de programa de computador".
- Efetue o pagamento. Guarde o comprovante bancário e o número da GRU paga.

Etapa 3: Preenchimento do Formulário Eletrônico
- Acesse o sistema e-Software do INPI.
- Forneça os dados básicos da criação: título, campo de aplicação (ex: Educacional), 
  linguagem (TypeScript/React), nomes de autores/proprietários (você ou sua empresa).
- No campo destinado ao "Resumo Digital (Hash)":
  1. Selecione o algoritmo: "SHA-256"
  2. Cole EXATAMENTE o hash gerador deste documento:
     ${sha256Hex}
  3. No tipo de representação, marque "Hexadecimal".

Etapa 4: Declaração de Veracidade (DV)
- O INPI não exige mais o upload do código-fonte completo em seus servidores. Ele exige 
  apenas que você assine a Declaração de Veracidade e insira esse hash gerado.
- Caso precise comprovar a integridade de seu código em uma disputa jurídica, esse arquivo 
  "hiperreforco-source.zip" que você gerou DEVE ser mantido guardado intacto. Na justiça, 
  o juiz gerará o SHA-256 do seu arquivo zip e o comparará com o hash registrado no INPI. 
  Eles devem ser idênticos.

------------------------------------------------------------------------
5. INSTRUÇÕES DE ARQUIVAMENTO DE SEGURANÇA
------------------------------------------------------------------------
- Guarde com o maior cuidado possível o arquivo "hiperreforco-source.zip" em múltiplos 
  backups seguros (Drive, Nuvem, Pendrive).
- NUNCA mude uma vírgula ou altere os arquivos dentro do arquivo ZIP "hiperreforco-source.zip", 
  pois qualquer modificação (mesmo de espaço em branco ou data de modificação) altera 
  completamente o hash SHA-256 gerado, inutilizando a prova de anterioridade caso precise!

Gerado eletronicamente por HiperReforço-DevOps.
========================================================================
`;

try {
  fs.writeFileSync(instructionsPath, declarationContent);
  console.log(`OK: Documento informativo gravado em: ${instructionsPath}`);
  console.log("\n=========================================================");
  console.log("SUCESSO! O hash correspondente ao seu código-fonte para o INPI foi gerado.");
  console.log(`Utilize o HASH: ${sha256Hex}`);
  console.log("=========================================================");
} catch (err) {
  console.error("Erro ao gravar documento informador:", err);
  process.exit(1);
}
