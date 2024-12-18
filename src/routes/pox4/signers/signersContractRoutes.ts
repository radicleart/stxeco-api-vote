import express from "express";
import { getSigners, getSignersRecent, stackerdbGetConfig, stackerdbGetSignerSlotsPage } from "./signers_contract_helper";
import { VerifySignerKey } from "@mijoco/stx_helpers/dist/index";
import { verifySignerKeySig } from "@mijoco/stx_helpers/dist/pox/pox";
import { getConfig } from "../../../lib/config";

const router = express.Router();

router.get("/get-signers/:cycle", async (req, res, next) => {
  try {
    const cycleInfo = await getSigners(Number(req.params.cycle));
    return res.send(cycleInfo);
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching pox-info.')
  }
});

router.get("/get-recent-signers", async (req, res, next) => {
  try {
    const cycleInfo = await getSignersRecent();
    return res.send(cycleInfo);
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching pox-info.')
  }
});

router.get("/stackerdb-get-config", async (req, res, next) => {
  try {
    const cycleInfo = await stackerdbGetConfig();
    return res.send(cycleInfo);
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching pox-info.')
  }
});

router.get("/stackerdb-get-signer-slots-page", async (req, res, next) => {
  try {
    const page0 = await stackerdbGetSignerSlotsPage(0);
    const page1 = await stackerdbGetSignerSlotsPage(1);
    return res.send({page0, page1});
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching pox-info.')
  }
});

router.post("/verify-signer-key-sig", async (req, res, next) => {
  try {
    const auth = req.body as VerifySignerKey;

    const result = await verifySignerKeySig(getConfig().stacksApi, getConfig().network, getConfig().poxContractId!, auth) ;
    return res.send(result);
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching pox-info.')
  }
});



export { router as signersContractRoutes }


