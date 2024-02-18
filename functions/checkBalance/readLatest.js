const automatedFunctionsConsumerAbi = require("../../abi/crosschainBalance.json");
const ethers = require("ethers");
const { ReturnType, decodeResult } = require("@chainlink/functions-toolkit");
require("@chainlink/env-enc").config();

const consumerAddress = "0x2E8d910D435Db139a0EcF5D4142eAAf393D12B1B";

const readLatest = async () => {
  // Initialize ethers  provider to read data from the contract
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

  const automatedFunctionsConsumer = new ethers.Contract(
    consumerAddress,
    automatedFunctionsConsumerAbi,
    signer
  );

  //Manually Trigger a send Request
  // const transaction = await automatedFunctionsConsumer.sendRequestCBOR();

  //Use the counter to get the latest ID
  const serialNumber = await automatedFunctionsConsumer.requestCounter();
  const lastRequestId = await automatedFunctionsConsumer.requestsIDs(
    serialNumber
  );

  console.log("last request ID is", lastRequestId);

  const lastResponse = await automatedFunctionsConsumer.responses(
    lastRequestId
  );

  const response = lastResponse[1];
  const error = lastResponse[2];
  const isResponse = response !== "0x";
  const isError = error !== "0x";

  if (isError) {
    console.log(error);
    const bytes = ethers.utils.arrayify(error);
    const decodedString = ethers.utils.toUtf8String(bytes);
    console.log(`❌ Error : `, decodedString);
  } else if (isResponse) {
    const returnType = ReturnType.uint256;
    const decodedResponse = decodeResult(response, returnType);
    console.log(`✅ Decoded response to ${returnType}: `, decodedResponse);
  }
};

readLatest().catch((e) => {
  console.error(e);
  process.exit(1);
});
