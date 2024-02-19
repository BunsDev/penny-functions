const fs = require("fs");
const path = require("path");
const {
  SecretsManager,
  simulateScript,
  buildRequestCBOR,
  ReturnType,
  decodeResult,
  Location,
  CodeLanguage,
} = require("@chainlink/functions-toolkit");
const automatedFunctionsConsumerAbi = require("../../abi/crosschainBalance.json");
const pennypotCoreABI = require("../../abi/pennypot.json");
const ethers = require("ethers");
require("@chainlink/env-enc").config();

const consumerAddress = "0xBE7a31cCD5504Cfc1B8534f18eD163fE69eed2c5";
const pennypotAddress = "0x0f4529D6cC15CB74756e7C2896cb08D42229647f";
const SavingsPot = "0x75ef591F5371B2170d00915A4A551Ee843FCe969";
const user = "0xf2750684eB187fF9f82e2F980f6233707eF5768C";
const token = "0x88233eEc48594421FA925D614b3a94A2dDC19a08";

const updateRequest = async () => {
  const routerAddress = "0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0";
  const donId = "fun-avalanche-fuji-1";

  const gatewayUrls = [
    "https://01.functions-gateway.testnet.chain.link/",
    "https://02.functions-gateway.testnet.chain.link/",
  ];
  const explorerUrl = "https://subnets-test.avax.network/c-chain";

  // Initialize functions settings
  const source = fs
    .readFileSync(path.resolve(__dirname, "source.js"))
    .toString();

  const args = [
    "avalanche-testnet",
    user,
    token, //token
  ];

  const secrets = { apiKey: process.env.COVALENT_API_KEY };
  const slotIdNumber = 0;
  const expirationTimeMinutes = 150;
  const gasLimit = 300000;

  // Initialize ethers signer and provider to interact with the contracts onchain
  const privateKey = process.env.PRIVATE_KEY; // fetch PRIVATE_KEY
  if (!privateKey)
    throw new Error(
      "private key not provided - check your environment variables"
    );

  const rpcUrl = process.env.FUJI_RPC_URL; // fetch fuji RPC URL

  if (!rpcUrl)
    throw new Error(`rpcUrl not provided  - check your environment variables`);

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const wallet = new ethers.Wallet(privateKey);
  const signer = wallet.connect(provider);

  //////// MAKE REQUEST ////////

  console.log("\nMake request...");

  // First encrypt secrets and upload the encrypted secrets to the DON
  const secretsManager = new SecretsManager({
    signer: signer,
    functionsRouterAddress: routerAddress,
    donId: donId,
  });
  await secretsManager.initialize();

  // Encrypt secrets and upload to DON
  const encryptedSecretsObj = await secretsManager.encryptSecrets(secrets);

  console.log(
    `Upload encrypted secret to gateways ${gatewayUrls}. slotId ${slotIdNumber}. Expiration in minutes: ${expirationTimeMinutes}`
  );

  // Upload secrets
  const uploadResult = await secretsManager.uploadEncryptedSecretsToDON({
    encryptedSecretsHexstring: encryptedSecretsObj.encryptedSecrets,
    gatewayUrls: gatewayUrls,
    slotId: slotIdNumber,
    minutesUntilExpiration: expirationTimeMinutes,
  });

  if (!uploadResult.success)
    throw new Error(`Encrypted secrets not uploaded to ${gatewayUrls}`);

  console.log(
    `\n✅ Secrets uploaded properly to gateways ${gatewayUrls}! Gateways response: `,
    uploadResult
  );

  const donHostedSecretsVersion = parseInt(uploadResult.version); // fetch the version of the encrypted secrets
  const donHostedEncryptedSecretsReference =
    secretsManager.buildDONHostedEncryptedSecretsReference({
      slotId: slotIdNumber,
      version: donHostedSecretsVersion,
    });

  const automatedFunctionsConsumer = new ethers.Contract(
    consumerAddress,
    automatedFunctionsConsumerAbi,
    signer
  );

  // Encode request
  const functionsRequestBytesHexString = buildRequestCBOR({
    codeLocation: Location.Inline,
    codeLanguage: CodeLanguage.JavaScript,
    secretsLocation: Location.DONHosted,
    source: source,
    encryptedSecretsReference: donHostedEncryptedSecretsReference,
    args: args,
    bytesArgs: [],
  });

  //pennypot
  const pennypotCore = new ethers.Contract(
    pennypotAddress,
    pennypotCoreABI,
    signer
  );

  // Update request settings
  const transaction = await pennypotCore.optIn(
    ethers.utils.getAddress(SavingsPot),
    token,
    3600,
    functionsRequestBytesHexString,
    ethers.utils.getAddress(consumerAddress)
  );

  // Log transaction details
  console.log(
    `\n✅ Automated savings and balance checker opted in! Transaction hash ${transaction.hash} - Check the explorer ${explorerUrl}/tx/${transaction.hash}`
  );
};

updateRequest().catch((e) => {
  console.error(e);
  process.exit(1);
});
